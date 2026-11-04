/**
 * ╔═╗ ╔═╗ ╔╗  ╔══ ╔═╗ ╔═╗ ╔╦╗ ╔═╗
 * ╚═╗ ║ ║ ╠╩╗ ╠═  ╠╦╝ ╚═╗ ║║║ ╚═╗
 * ╚═╝ ╚═╝ ╚═╝ ╚══ ╩╚═ ╚═╝ ╩ ╩ ╚═╝
 * @author Dev Soberano
 * @link https://github.com/dev-soberano
 * @project SoberSMS
 */
// ============================================================================
// SoberSMS → MisticPay (Pix)
// ----------------------------------------------------------------------------
// Mesma interface do módulo de pagamento anterior (createPixPayment /
// getPayment / MIN_AMOUNT), então os handlers não mudam. A MisticPay trabalha
// com o MESMO transactionId que a gente define: é com ele que consultamos o
// status depois — não há webhook para configurar.
// ============================================================================

const config = require("./config");

const BASE_URL = "https://api.misticpay.com/api";

// CPF do pagador: a API exige 11 dígitos, mas não valida o dígito verificador.
// Usamos um placeholder obviamente falso (não passamos CPF de terceiro como se
// fosse do cliente — dado falso identificável é melhor que dado alheio).
const PAYER_DOCUMENT = "00000000000";

// A MisticPay cobra R$ 0,50 fixos por transação (de R$ 5 a R$ 500).
const MIN_AMOUNT = 5;
const MAX_AMOUNT = 500;

const STATUS_MAP = {
  COMPLETO: "approved",
  PENDENTE: "pending",
  FALHA: "failed",
  CANCELADO: "cancelled",
};

function authHeader() {
  return (
    "Basic " +
    Buffer.from(`${config.misticClientId}:${config.misticClientSecret}`).toString("base64")
  );
}

function erroLegivel(prefixo, error) {
  const d = error?.response?.data || {};
  const msg = d.message || d.error || error?.message || "erro desconhecido";
  return new Error(`${prefixo}: ${msg}`);
}

/**
 * Cria uma cobrança Pix.
 * @param {number} amount valor EM REAIS (ex.: 35.5)
 * @returns {{ id, status, qrCode, qrCodeBase64, ticketUrl }}
 *   `qrCodeBase64` sai em base64 puro (sem o prefixo data URI), que é o que o
 *   bot usa para mandar a imagem do QR.
 */
async function createPixPayment({ amount, description, externalReference, payerName }) {
  const valor = Number(amount);
  if (!Number.isFinite(valor) || valor < MIN_AMOUNT) {
    const err = new Error(`O valor mínimo de recarga é R$ ${MIN_AMOUNT.toFixed(2)}.`);
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  if (valor > MAX_AMOUNT) {
    const err = new Error(`O valor máximo de recarga é R$ ${MAX_AMOUNT.toFixed(2)}.`);
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  if (!externalReference) {
    const err = new Error("Referência da recarga ausente.");
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  let response;
  try {
    response = await fetch(`${BASE_URL}/transactions/create`, {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: Number(valor.toFixed(2)),
        payerName: payerName || `Cliente ${config.botName}`,
        payerDocument: PAYER_DOCUMENT,
        transactionId: String(externalReference),
        description: description || `Recarga ${config.botName}`,
      }),
    });
  } catch (e) {
    throw erroLegivel("Falha de conexão com o pagamento", e);
  }

  const body = await response.json().catch(() => ({}));
  const data = body?.data || {};

  if (!response.ok || !data.copyPaste) {
    const err = erroLegivel("Não foi possível gerar o Pix", {
      response: { data: body },
      message: body?.message || `HTTP ${response.status}`,
    });
    if (response.status === 400) err.code = "VALIDATION_ERROR";
    throw err;
  }

  return {
    id: String(data.transactionId || externalReference),
    status: "pending",
    qrCode: data.copyPaste,
    qrCodeBase64: extrairBase64(data.qrCodeBase64),
    ticketUrl: null,
  };
}

/** O QR vem como data URI; o bot espera base64 puro. */
function extrairBase64(valor) {
  if (typeof valor !== "string") return null;
  const m = valor.match(/^data:image\/[a-z]+;base64,(.+)$/);
  return m ? m[1] : valor;
}

/**
 * Consulta o status de uma cobrança.
 * @returns {{ external_reference, status }} status no padrão do bot:
 *   'approved' | 'pending' | 'failed' | 'cancelled'
 */
async function getPayment(paymentId) {
  if (!paymentId) {
    const err = new Error("Identificador de pagamento inválido.");
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  let response;
  try {
    response = await fetch(`${BASE_URL}/transactions/check`, {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ transactionId: String(paymentId) }),
    });
  } catch (e) {
    throw erroLegivel("Falha de conexão ao consultar o pagamento", e);
  }

  const body = await response.json().catch(() => ({}));
  const tx = body?.transaction || {};
  const estado = String(tx.transactionState || "").toUpperCase();

  return {
    external_reference: String(paymentId),
    status: STATUS_MAP[estado] || "pending",
    raw: tx,
  };
}

// A confirmação é feita por consulta (polling) — não usamos webhook.
function verifyWebhookSignature() {
  return false;
}

module.exports = {
  createPixPayment,
  getPayment,
  verifyWebhookSignature,
  MIN_AMOUNT,
  MAX_AMOUNT,
};
