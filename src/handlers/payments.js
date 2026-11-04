/**
 * ╔═╗ ╔═╗ ╔╗  ╔══ ╔═╗ ╔═╗ ╔╦╗ ╔═╗
 * ╚═╗ ║ ║ ╠╩╗ ╠═  ╠╦╝ ╚═╗ ║║║ ╚═╗
 * ╚═╝ ╚═╝ ╚═╝ ╚══ ╩╚═ ╚═╝ ╩ ╩ ╚═╝
 * @author Dev Soberano
 * @link https://github.com/dev-soberano
 * @project SoberSMS
 */
const db = require("../db");
const mp = require("../pagamentos");

/**
 * Webhook opcional de pagamento (a confirmação principal é o polling em payments-poller.js).
 * Responde 200 sempre: a MisticPay não envia webhook, mas mantemos a rota viva para o caso de configurar depois.
 */
async function handleWebhook(req, res, bot) {
  try {
    return res.sendStatus(200); // sem webhook configurado
    /* eslint-disable no-unreachable */
    const type = req.query.type || req.body?.type;
    const paymentId =
      req.query["data.id"] || req.body?.data?.id || req.body?.data_id;

    if (type !== "payment" || !paymentId) {
      res.sendStatus(200);
      return;
    }

    const payment = await mp.getPayment(paymentId);
    const externalRef = payment.external_reference;

    if (!externalRef) {
      res.sendStatus(200);
      return;
    }

    const recharge = db.getRecharge(Number(externalRef));
    if (!recharge) {
      res.sendStatus(200);
      return;
    }

    if (recharge.status === "pendente" && payment.status === "approved") {
      db.approveRecharge(recharge.recharge_id);
      try {
        await bot.telegram.sendMessage(
          recharge.user_id,
          `💎 Pagamento confirmado! Sua recarga de R$ ${recharge.amount.toFixed(
            2
          )} já foi creditada no seu saldo. 🎉`
        );
      } catch (e) {
        /* usuário pode ter bloqueado o bot */
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("Erro no webhook de pagamento:", err?.message || err);
    res.sendStatus(200);
  }
}

module.exports = { handleWebhook };
