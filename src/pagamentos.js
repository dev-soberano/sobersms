/**
 * ╔═╗ ╔═╗ ╔╗  ╔══ ╔═╗ ╔═╗ ╔╦╗ ╔═╗
 * ╚═╗ ║ ║ ╠╩╗ ╠═  ╠╦╝ ╚═╗ ║║║ ╚═╗
 * ╚═╝ ╚═╝ ╚═╝ ╚══ ╩╚═ ╚═╝ ╩ ╩ ╚═╝
 * @author Dev Soberano
 * @link https://github.com/dev-soberano
 * @project SoberSMS
 */
// ============================================================================
// SoberSMS — qual operadora de pagamento o bot usa
// ----------------------------------------------------------------------------
// O dono escolhe no painel (⚙️ Configurações): MisticPay ou Mercado Pago.
// O resto do bot só chama daqui, então trocar de operadora não mexe em código.
// ============================================================================

const config = require("./config");
const misticpay = require("./misticpay");
const mercadopago = require("./mercadopago");

function provedor() {
  return config.pagamento === "mercadopago" ? mercadopago : misticpay;
}

module.exports = {
  createPixPayment: (args) => provedor().createPixPayment(args),
  getPayment: (id) => provedor().getPayment(id),
  verifyWebhookSignature: () => false,

  get MIN_AMOUNT() {
    return provedor().MIN_AMOUNT;
  },
  get MAX_AMOUNT() {
    return provedor().MAX_AMOUNT;
  },

  /** Nome da operadora em uso (para mostrar na interface). */
  nome() {
    return config.pagamento === "mercadopago" ? "Mercado Pago" : "MisticPay";
  },
  /** Código da operadora em uso: 'misticpay' | 'mercadopago'. */
  codigo() {
    return config.pagamento === "mercadopago" ? "mercadopago" : "misticpay";
  },
};
