// ============================================================================
// SoberSMS — confirmação automática de recargas (Pix)
// ----------------------------------------------------------------------------
// A MisticPay não chama webhook aqui: a gente CONSULTA as recargas pendentes de
// vez em quando e credita o saldo quando o pagamento cai. É a mesma rotina que
// o site principal usa (reconciliação), então não depende de URL pública.
// ============================================================================

const db = require("./db");
const mp = require("./pagamentos");
const config = require("./config");

function startPaymentPoller(bot) {
  const intervalo = Math.max(10, config.paymentPollIntervalMs || 20000);

  setInterval(async () => {
    let pendentes;
    try {
      pendentes = db.listPendingRecharges();
    } catch (e) {
      console.error("[pix] falha ao listar recargas pendentes:", e.message);
      return;
    }

    for (const recarga of pendentes) {
      const paymentId = recarga.mp_payment_id;
      if (!paymentId) continue; // Pix ainda não foi gerado

      try {
        const pagamento = await mp.getPayment(paymentId);

        if (pagamento.status === "approved") {
          // approveRecharge só credita se ainda estiver 'pendente' (idempotente)
          const ok = db.approveRecharge(recarga.recharge_id);
          if (!ok) continue;
          console.log(
            `[pix] recarga #${recarga.recharge_id} confirmada (R$ ${Number(recarga.amount).toFixed(2)})`
          );
          try {
            await bot.telegram.sendMessage(
              recarga.user_id,
              `✅ Pagamento confirmado! Sua recarga de R$ ${Number(recarga.amount).toFixed(
                2
              )} já foi creditada no seu saldo. 💰`
            );
          } catch (_) {
            /* usuário pode ter bloqueado o bot */
          }
        } else if (["failed", "cancelled"].includes(pagamento.status)) {
          db.rejectRecharge(recarga.recharge_id);
          console.log(`[pix] recarga #${recarga.recharge_id} não paga (${pagamento.status})`);
        }
      } catch (e) {
        console.error(
          `[pix] erro ao consultar recarga #${recarga.recharge_id}:`,
          e.message
        );
      }
    }
  }, intervalo);
}

module.exports = { startPaymentPoller };
