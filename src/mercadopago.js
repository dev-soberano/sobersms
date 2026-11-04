// ============================================================================
// SoberSMS → Mercado Pago (Pix) — via API REST, sem SDK.
// Mesma interface do módulo de pagamento (createPixPayment / getPayment /
// MIN_AMOUNT), então quem usa o bot escolhe a operadora no painel e nada mais
// muda no código.
// ============================================================================

const crypto = require("crypto");
const config = require("./config");

const BASE_URL = "https://api.mercadopago.com/v1";
const MIN_AMOUNT = 10;
const MAX_AMOUNT = 5000;

const STATUS_MAP = {
  approved: "approved",
  pending: "pending",
  in_process: "pending",
  in_mediation: "pending",
  rejected: "failed",
  cancelled: "cancelled",
  refunded: "cancelled",
  charged_back: "cancelled",
};

function headers() {
  return {
    Authorization: `Bearer ${config.mpAccessToken}`,
    "Content-Type": "application/json",
    "X-Idempotency-Key": crypto.randomUUID(),
  };
}

async function createPixPayment({ amount, description, externalReference, payerEmail }) {
  const valor = Number(amount);
  if (!Number.isFinite(valor) || valor < MIN_AMOUNT) {
    const err = new Error(`O valor mínimo de recarga é R$ ${MIN_AMOUNT.toFixed(2)}.`);
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  if (!config.mpAccessToken) {
    const err = new Error("Access Token do Mercado Pago não configurado.");
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  const res = await fetch(`${BASE_URL}/payments`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      transaction_amount: Number(valor.toFixed(2)),
      description: description || `Recarga ${config.botName}`,
      payment_method_id: "pix",
      external_reference: String(externalReference),
      payer: { email: payerEmail || `cliente@${(config.botName || "bot").toLowerCase().replace(/\s+/g, "")}.com` },
    }),
  }).catch((e) => {
    const err = new Error("Falha de conexão com o Mercado Pago: " + e.message);
    err.code = "VALIDATION_ERROR";
    throw err;
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body || !body.id) {
    const msg = body?.message || body?.error || `HTTP ${res.status}`;
    const err = new Error("Não foi possível gerar o Pix: " + msg);
    if (res.status === 400) err.code = "VALIDATION_ERROR";
    throw err;
  }

  const tx = body.point_of_interaction?.transaction_data || {};
  return {
    id: String(body.id),
    status: "pending",
    qrCode: tx.qr_code || "",
    qrCodeBase64: extrairBase64(tx.qr_code_base64),
    ticketUrl: tx.ticket_url || null,
  };
}

function extrairBase64(valor) {
  if (typeof valor !== "string") return null;
  const m = valor.match(/^data:image\/[a-z]+;base64,(.+)$/);
  return m ? m[1] : valor;
}

async function getPayment(paymentId) {
  if (!paymentId) {
    const err = new Error("Identificador de pagamento inválido.");
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  const res = await fetch(`${BASE_URL}/payments/${encodeURIComponent(paymentId)}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${config.mpAccessToken}` },
  }).catch((e) => {
    const err = new Error("Falha de conexão ao consultar o pagamento: " + e.message);
    err.code = "VALIDATION_ERROR";
    throw err;
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error("Não foi possível consultar o pagamento: " + (body?.message || `HTTP ${res.status}`));
  }

  return {
    external_reference: String(body.external_reference ?? paymentId),
    status: STATUS_MAP[String(body.status || "").toLowerCase()] || "pending",
    raw: body,
  };
}

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
