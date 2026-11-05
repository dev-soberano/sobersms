/**
 * ╔═╗ ╔═╗ ╔╗  ╔══ ╔═╗ ╔═╗ ╔╦╗ ╔═╗
 * ╚═╗ ║ ║ ╠╩╗ ╠═  ╠╦╝ ╚═╗ ║║║ ╚═╗
 * ╚═╝ ╚═╝ ╚═╝ ╚══ ╩╚═ ╚═╝ ╩ ╩ ╚═╝
 * @author Dev Soberano
 * @link https://github.com/dev-soberano
 * @project SoberSMS
 */
const { Markup } = require("telegraf");
const config = require("./config");

function mainMenu(isAdmin) {
  const rows = [
    [Markup.button.callback("📱 Serviços", "menu:services")],
    [
      Markup.button.callback("👤 Perfil", "menu:profile"),
      Markup.button.callback("🤝 Afiliados", "menu:affiliates"),
    ],
    [Markup.button.callback("💎 Recarga", "menu:recharge")],
    [
      Markup.button.callback("📦 Histórico", "menu:history"),
      Markup.button.callback("🎟️ Cupom", "menu:coupon"),
    ],
    [
      Markup.button.callback("❓ Como usar", "menu:howto"),
      Markup.button.callback("🆘 Suporte", "menu:support"),
    ],
    [Markup.button.callback("📄 Termos", "menu:terms"), Markup.button.callback("ℹ️ Sobre", "menu:about")],
  ];

  if (config.canalReferencia) {
    rows.push([
      Markup.button.url(
        "📣 Canal referência",
        `https://t.me/${config.canalReferencia.replace("@", "")}`
      ),
    ]);
  }

  if (isAdmin) {
    rows.push([Markup.button.callback("⚙️ Painel Admin", "admin:panel")]);
  }

  return Markup.inlineKeyboard(rows);
}

function backButton(target = "menu:home") {
  return Markup.inlineKeyboard([[Markup.button.callback("⬅️ Voltar", target)]]);
}

function categoriesKb(categories) {
  const rows = categories.map((c) => [
    Markup.button.callback(`📂 ${c}`, `cat:${c}`),
  ]);
  rows.push([Markup.button.callback("⬅️ Voltar", "menu:home")]);
  return Markup.inlineKeyboard(rows);
}

function productsKb(products, category) {
  const rows = products.map((p) => [
    Markup.button.callback(
      `${p.name} — R$ ${p.price.toFixed(2)} (${p.stock} disp.)`,
      `product:${p.product_id}`
    ),
  ]);
  const back = category ? "menu:categories" : "menu:home";
  rows.push([Markup.button.callback("⬅️ Voltar", back)]);
  return Markup.inlineKeyboard(rows);
}

function productDetailKb(productId, backTarget = "menu:services") {
  return Markup.inlineKeyboard([
    [Markup.button.callback("✅ Comprar", `buy:${productId}`)],
    [Markup.button.callback("🎟️ Aplicar cupom", `applycoupon:${productId}`)],
    [Markup.button.callback("⬅️ Voltar", backTarget)],
  ]);
}

function rechargeAmountsKb() {
  const amounts = [5, 10, 20, 50, 100];
  const rows = amounts.map((a) => [
    Markup.button.callback(`R$ ${a},00`, `recharge_amt:${a}`),
  ]);
  rows.push([Markup.button.callback("✏️ Outro valor", "recharge_amt:custom")]);
  rows.push([Markup.button.callback("⬅️ Voltar", "menu:home")]);
  return Markup.inlineKeyboard(rows);
}

function pixPaymentKb(ticketUrl, paymentId, brCode) {
  const rows = [];
  if (brCode) rows.push([copyButton("📋 Copiar código Pix", brCode)]);
  if (ticketUrl) {
    rows.push([Markup.button.url("🔗 Ver pagamento", ticketUrl)]);
  }
  rows.push([Markup.button.callback("📋 Verificar pagamento", `checkpix:${paymentId}`)]);
  rows.push([Markup.button.callback("⬅️ Menu", "menu:home")]);
  return Markup.inlineKeyboard(rows);
}

function affiliatesKb() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("📋 Copiar link afiliado", "aff:copy")],
    [Markup.button.callback("⬅️ Voltar", "menu:home")],
  ]);
}

function adminPanelKb() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("⚙️ Configurações", "admin:config")],
    [
      Markup.button.callback("🎟️ Criar cupom", "admin:add_coupon"),
      Markup.button.callback("📋 Ver cupons", "admin:list_coupons"),
    ],
    [
      Markup.button.callback("💰 Recargas pendentes", "admin:recharges"),
      Markup.button.callback("🛒 Pedidos recentes", "admin:orders"),
    ],
    [
      Markup.button.callback("👤 Ajustar saldo", "admin:adjust_balance"),
      Markup.button.callback("🚫 Banir/Desbanir", "admin:ban_user"),
    ],
    [
      Markup.button.callback("📊 Estatísticas", "admin:stats"),
      Markup.button.callback("💰 Saldo API", "admin:api_balance"),
    ],
    [Markup.button.callback("📢 Enviar broadcast", "admin:broadcast")],
    [Markup.button.callback("⬅️ Voltar", "menu:home")],
  ]);
}

function rechargeApprovalKb(rechargeId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("✅ Aprovar", `rch_ok:${rechargeId}`),
      Markup.button.callback("❌ Rejeitar", `rch_no:${rechargeId}`),
    ],
  ]);
}

function banToggleKb(userId, isBanned) {
  const action = isBanned ? "unban" : "ban";
  const label = isBanned ? "✅ Desbanir" : "🚫 Banir";
  return Markup.inlineKeyboard([
    [Markup.button.callback(label, `${action}:${userId}`)],
    [Markup.button.callback("⬅️ Voltar", "admin:panel")],
  ]);
}

function stripEmoji(str) {
  return (str || "")
    .replace(
      /[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\uFE0F]/gu,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function smsProductsKb(products) {
  const buttons = (products || []).map((p) => stripEmoji(p.label));
  const rows = chunk(buttons, 2);
  rows.push(["🔎 Outro serviço"]);
  rows.push(["⬅️ Voltar"]);
  return Markup.keyboard(rows).resize();
}


function findSmsProductByText(products, text) {
  const clean = stripEmoji(text);
  const found = (products || []).find((p) => stripEmoji(p.label) === clean);
  return found ? found.code : null;
}

const SMS_COUNTRIES_PAGE_SIZE = 15;

function smsCountriesKb(product, allCountries, countryLabel, page = 0) {
  const start = page * SMS_COUNTRIES_PAGE_SIZE;
  const pageItems = allCountries.slice(start, start + SMS_COUNTRIES_PAGE_SIZE);

  // Só bandeira + nome: o preço aparece na tela seguinte, depois da escolha.
  const buttons = pageItems.map((c) => countryLabel(c.country));
  const rows = chunk(buttons, 2);

  const navRow = [];
  if (page > 0) navRow.push("⬅️ Anteriores");
  if (start + SMS_COUNTRIES_PAGE_SIZE < allCountries.length) navRow.push("Próximos ➡️");
  if (navRow.length) rows.push(navRow);

  rows.push(["⬅️ Voltar"]);
  return Markup.keyboard(rows).resize();
}


function findSmsCountryByText(allCountries, countryLabel, text) {
  const clean = (text || "").trim();
  const found = (allCountries || []).find((c) => countryLabel(c.country) === clean);
  return found ? found.country : null;
}

function smsConfirmKb(product, country) {
  return Markup.inlineKeyboard([
    [Markup.button.callback("📱 Receber SMS", `smsgo:${product}:${country}`)],
    [Markup.button.callback("⬅️ Voltar", `smsproduct:${product}`)],
  ]);
}

// Botão que copia direto para a área de transferência (Bot API 7.11+).
function copyButton(label, texto) {
  return { text: label, copy_text: { text: String(texto) } };
}

function smsOrderKb(orderId, canCancel, phone) {
  const rows = [];
  if (phone) rows.push([copyButton("📋 Copiar número", phone)]);
  if (canCancel) {
    rows.push([Markup.button.callback("❌ Cancelar", `smscancel:${orderId}`)]);
  }
  rows.push([Markup.button.callback("⬅️ Menu", "menu:home")]);
  return Markup.inlineKeyboard(rows);
}

function smsCodeKb(orderId, code, phone) {
  const rows = [[copyButton("📋 Copiar SMS", code)]];
  if (phone) rows.push([copyButton("📋 Copiar número", phone)]);
  rows.push([Markup.button.callback("⬅️ Menu", "menu:home")]);
  return Markup.inlineKeyboard(rows);
}

module.exports = {
  mainMenu,
  backButton,
  categoriesKb,
  productsKb,
  productDetailKb,
  rechargeAmountsKb,
  pixPaymentKb,
  affiliatesKb,
  adminPanelKb,
  rechargeApprovalKb,
  banToggleKb,
  smsProductsKb,
  findSmsProductByText,
  smsCountriesKb,
  findSmsCountryByText,
  smsConfirmKb,
  smsOrderKb,
  smsCodeKb,
  copyButton,
};