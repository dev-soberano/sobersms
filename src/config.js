/**
 * ╔═╗ ╔═╗ ╔╗  ╔══ ╔═╗ ╔═╗ ╔╦╗ ╔═╗
 * ╚═╗ ║ ║ ╠╩╗ ╠═  ╠╦╝ ╚═╗ ║║║ ╚═╗
 * ╚═╝ ╚═╝ ╚═╝ ╚══ ╩╚═ ╚═╝ ╩ ╩ ╚═╝
 * @author Dev Soberano
 * @link https://github.com/dev-soberano
 * @project SoberSMS
 */
require("dotenv").config();

const settings = require("./settings");

function parseAdminIds(raw) {
  return (raw || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number);
}

const envAdminIds = parseAdminIds(process.env.ADMIN_IDS);

// Valor do painel do dono (settings.json) ganha da variável de ambiente.
function val(chaveSettings, env, padrao) {
  const v = settings.get(chaveSettings);
  if (v !== undefined && v !== null) return v;
  const e = process.env[env];
  if (e !== undefined && e !== "") return e;
  return padrao;
}

module.exports = {
  // --- Infraestrutura (fica no .env, não muda pelo Telegram) ---
  botToken: process.env.BOT_TOKEN,
  adminIds: envAdminIds,
  dbPath: process.env.DB_PATH || "sobersms.json",
  port: Number(process.env.PORT || 25594),
  publicUrl: process.env.PUBLIC_URL || "",
  comissaoAfiliado: Number(process.env.COMISSAO_AFILIADO || 10),
  estoqueMinimo: Number(process.env.ESTOQUE_MINIMO || 3),
  smsPollIntervalMs: Number(process.env.SMS_POLL_INTERVAL_MS || 20000),
  paymentPollIntervalMs: Number(process.env.PAYMENT_POLL_INTERVAL_MS || 20000),

  // --- Identidade (mudável pelo painel) ---
  get botName() {
    return val("botName", "BOT_NAME", "SoberSMS");
  },
  get ownerTag() {
    return val("ownerTag", "OWNER_TAG", "Dev Soberano");
  },
  get welcomeImage() {
    return val("welcomeImage", "WELCOME_IMAGE", "assets/bah.png");
  },
  get canalReferencia() {
    return val("canalReferencia", "CANAL_REFERENCIA", "");
  },

  // --- Servicos SMS vendidos ---
  // Botoes da tela de compra. O dono pode ajustar em settings.json
  // (chave smsProducts). Qualquer outro servico e acessivel pelo
  // "Outro servico" (o cliente digita o nome em ingles).
  get smsProducts() {
    const v = settings.get("smsProducts");
    if (Array.isArray(v) && v.length) return v;
    return [
      { code: "whatsapp", label: "💬 WhatsApp" },
      { code: "telegram", label: "✈️ Telegram" },
      { code: "instagram", label: "📸 Instagram" },
      { code: "facebook", label: "👤 Facebook" },
      { code: "tiktok", label: "🎵 TikTok" },
      { code: "google", label: "🔍 Google" },
      { code: "twitter", label: "🐦 Twitter / X" },
      { code: "discord", label: "🎮 Discord" },
      { code: "netflix", label: "🎬 Netflix" },
      { code: "spotify", label: "🎧 Spotify" },
      { code: "openai", label: "🤖 OpenAI" },
      { code: "uber", label: "🚗 Uber" },
      { code: "ifood", label: "🍔 iFood" },
      { code: "shopee", label: "🛍️ Shopee" },
      { code: "mercadolivre", label: "📦 Mercado Livre" },
    ];
  },

  // --- API de números (Gótica SMS) ---
  // Endereço FIXO de propósito: este bot foi feito para a API da Gótica SMS.
  // Quem instala só precisa da chave — não tem campo de "outra API" em lugar
  // nenhum (nem no painel), então não dá para trocar por fora sem mexer no
  // código.
  apiUrl: "https://gotica-sms.com/api/v1",
  get apiKey() {
    return val("apiKey", "API_KEY", "");
  },
  get priceMultiplier() {
    return Number(val("priceMultiplier", "PRICE_MULTIPLIER", 2));
  },
  get brazilPrice() {
    return Number(val("brazilPrice", "BRAZIL_PRICE", 13));
  },

  // --- Pagamento ---
  // 'misticpay' | 'mercadopago'
  get pagamento() {
    return String(val("pagamento", "PAGAMENTO", "misticpay")).toLowerCase();
  },
  get misticClientId() {
    return val("misticClientId", "MISTICPAY_CLIENT_ID", "");
  },
  get misticClientSecret() {
    return val("misticClientSecret", "MISTICPAY_CLIENT_SECRET", "");
  },
  get mpAccessToken() {
    return val("mpAccessToken", "MP_ACCESS_TOKEN", "");
  },
  get minDeposit() {
    return Number(val("minDeposit", "MIN_DEPOSIT", 5));
  },
  get maxDeposit() {
    return Number(val("maxDeposit", "MAX_DEPOSIT", 500));
  },

  // --- Dono ---
  // Quem controla o bot: o ID salvo no painel (primeiro a usar assume) ou o
  // ADMIN_IDS do .env.
  get ownerId() {
    const v = settings.get("ownerId");
    return v ? Number(v) : null;
  },
  set ownerId(id) {
    settings.set("ownerId", Number(id));
  },

  /** O usuário é dono? (quem roda o bot controla tudo pelo Telegram) */
  ehDono(userId) {
    const id = Number(userId);
    if (this.ownerId && this.ownerId === id) return true;
    if (envAdminIds.includes(id)) {
      // registra de quem é o bot, para os próximos comandos
      if (!this.ownerId) settings.set("ownerId", id);
      return true;
    }
    return false;
  },

  /**
   * Primeiro usuário a abrir o bot assume a posse dele (o bot é instalado pelo
   * próprio dono, então é ele quem chega primeiro). Só funciona enquanto não
   * existe dono.
   */
  reivindicar(userId) {
    if (this.ownerId || envAdminIds.length) return false;
    settings.set("ownerId", Number(userId));
    return true;
  },
};
