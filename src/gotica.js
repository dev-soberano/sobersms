const config = require("./config");

// ============================================================================
// SoberSMS → API de números da Gótica (whitelabel)
// ----------------------------------------------------------------------------
// O bot compra números por uma API e revende com margem. Este módulo fala com a
// API e devolve EXATAMENTE o mesmo formato que o código já espera (o do provedor anterior),
// então os handlers não precisam saber de onde vem o número. Nada do que vem
// daqui menciona fornecedor, custo ou código interno.
// ============================================================================

const BASE_URL = config.apiUrl;

// Status da API → status que o resto do bot entende
//   WAITING   → PENDING   (aguardando SMS)
//   RECEIVED  → FINISHED  (SMS chegou, tem código)
//   CANCELLED → TIMEOUT   (expirou/cancelou e a API já devolveu o saldo →
//                          o bot devolve o saldo do cliente também)
const STATUS_MAP = {
  WAITING: "PENDING",
  RECEIVED: "FINISHED",
  CANCELLED: "TIMEOUT",
};

let meta = { countries: [], services: [] };
let metaLoaded = false;

/**
 * Preço de VENDA ao cliente (REGRA DO DONO):
 *   • Brasil: R$ 13,00 FIXO, qualquer serviço (com piso de custo + R$ 1,00
 *     para nunca vender no prejuízo, por mais que o custo suba);
 *   • fora do Brasil: o DOBRO do que a API cobra (lucro = 100% do custo).
 */
function venderPor(apiPrice, country) {
  const custo = Number(apiPrice) || 0;
  const brasil = String(country || "").toLowerCase() === "br";
  if (brasil) {
    return Math.max(config.brazilPrice, Math.ceil((custo + 1) * 100) / 100);
  }
  return Math.ceil(custo * config.priceMultiplier * 100) / 100;
}

function isoToFlagEmoji(iso2) {
  if (!iso2 || iso2.length !== 2) return "";
  const codePoints = [...String(iso2).toUpperCase()].map((c) => 127397 + c.charCodeAt());
  return String.fromCodePoint(...codePoints);
}

function truncate(str, max = 200) {
  return typeof str === "string" && str.length > max ? `${str.slice(0, max)}…` : str;
}

async function request(path, { method = "GET", body, retry } = {}) {
  const headers = {
    "X-API-Key": config.apiKey,
    Accept: "application/json",
  };
  if (body) headers["Content-Type"] = "application/json";

  // Consultas podem ser repetidas com segurança (idempotentes). Compra NÃO:
  // repetir uma compra poderia comprar dois números.
  const tentativas = retry !== undefined ? retry : method === "GET" ? 3 : 1;

  let ultimoErro = null;
  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    let res;
    try {
      res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      ultimoErro = e;
      if (tentativa < tentativas) {
        await new Promise((r) => setTimeout(r, 1000 * tentativa));
        continue;
      }
      const err = new Error("Sem conexão com a API de números. Tente novamente.");
      err.cause = e;
      throw err;
    }

    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch (_) {
      json = null;
    }

    if (!res.ok) {
      // A API devolve { error: { code, message } } — usamos a mensagem dela,
      // que é segura (nunca revela fornecedor nem custo).
      const msg =
        (json && json.error && json.error.message) ||
        (json && json.error) ||
        `Erro HTTP ${res.status}`;
      const err = new Error(truncate(String(msg)));
      err.status = res.status;
      err.code = json && json.error && json.error.code;
      err.data = (json && json.error) || null;
      throw err;
    }

    return json;
  }

  throw ultimoErro || new Error("Falha ao falar com a API de números.");
}

async function ensureCountryMeta() {
  if (metaLoaded) return meta;
  try {
    const data = await request("/meta");
    meta = {
      countries: data.countries || [],
      services: data.services || [],
    };
    metaLoaded = true;
  } catch (e) {
    console.error("⚠️  Falha ao carregar países/serviços da API:", e.message);
  }
  return meta;
}

function countryLabel(country) {
  const found = meta.countries.find((c) => c.code === country);
  const nome = found ? found.name : String(country).toUpperCase();
  const flag = isoToFlagEmoji(country);
  return flag ? `${nome} ${flag}` : nome;
}

/** Países com preço para um serviço. */
async function listCountriesForProduct(product) {
  await ensureCountryMeta();
  const data = await request(`/prices?service=${encodeURIComponent(product)}`);
  return (data.prices || []).map((p) => ({
    country: p.country,
    costRub: Number(p.price),        // o que a API cobra do bot
    priceBrl: venderPor(p.price, p.country),  // o que o cliente paga
    count: 1,
  }));
}

/** Preço/estoque de um país específico. */
async function getCheapestForCountry(product, country) {
  const p = await request(
    `/price?service=${encodeURIComponent(product)}&country=${encodeURIComponent(country)}`
  );
  return {
    costRub: Number(p.price),
    priceBrl: venderPor(p.price, country),
    count: 1,
  };
}

async function buyActivation(country, product, _maxPrice) {
  const r = await request("/activations", {
    method: "POST",
    body: { service: product, country },
  });
  if (!r || !r.id || !r.phone) {
    const err = new Error("A API não retornou um número válido (pode ter esgotado).");
    err.raw = r;
    throw err;
  }
  return { id: r.id, phone: r.phone, price: r.price };
}

async function checkOrder(id) {
  const r = await request(`/activations/${encodeURIComponent(id)}`);
  return {
    status: STATUS_MAP[r.status] || "PENDING",
    sms: r.code ? [{ code: String(r.code) }] : [],
    raw: r,
  };
}

async function finishOrder(id) {
  return request(`/activations/${encodeURIComponent(id)}/finish`, {
    method: "POST",
    retry: 2,
  });
}

async function cancelOrder(id) {
  try {
    return await request(`/activations/${encodeURIComponent(id)}/cancel`, {
      method: "POST",
      retry: 2,
    });
  } catch (e) {
    // Cancelamento cedo demais tem regra da operadora: explicamos o tempo certo.
    if (e.code === "TOO_EARLY") {
      const s = Number(e.data && e.data.waitSeconds) || 0;
      const espera = s ? `${Math.ceil(s / 60)} min` : "2 minutos";
      const err = new Error(`Aguarde ${espera} para cancelar (regra da operadora).`);
      err.code = "TOO_EARLY";
      throw err;
    }
    throw e;
  }
}

/** Saldo do bot na API (já em reais). */
async function getProfile() {
  const r = await request("/balance");
  return { balance: Number(r.balance || 0) };
}

// Mantido por compatibilidade com o painel admin (o saldo já vem em BRL).
function rubToBrl(value) {
  return Number(value) || 0;
}

async function getProductPrices(product) {
  const list = await listCountriesForProduct(product);
  return {
    [product]: Object.fromEntries(
      list.map((c) => [c.country, { cost: c.costRub, count: c.count }])
    ),
  };
}

module.exports = {
  venderPor,
  countryLabel,
  ensureCountryMeta,
  rubToBrl,
  getProductPrices,
  listCountriesForProduct,
  getCheapestForCountry,
  getProfile,
  buyActivation,
  checkOrder,
  finishOrder,
  cancelOrder,
};
