/**
 * ╔═╗ ╔═╗ ╔╗  ╔══ ╔═╗ ╔═╗ ╔╦╗ ╔═╗
 * ╚═╗ ║ ║ ╠╩╗ ╠═  ╠╦╝ ╚═╗ ║║║ ╚═╗
 * ╚═╝ ╚═╝ ╚═╝ ╚══ ╩╚═ ╚═╝ ╩ ╩ ╚═╝
 * @author Dev Soberano
 * @link https://github.com/dev-soberano
 * @project SoberSMS
 */
const express = require("express");
const bot = require("./bot");
const db = require("./db");
const config = require("./config");
const { handleWebhook } = require("./handlers/payments");
const { startPaymentPoller } = require("./payments-poller");

db.init();
startPaymentPoller(bot);

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.send(`${config.botName} está no ar.`);
});

// Rota viva por formalidade: a confirmação de pagamento é feita por
// consulta (payments-poller.js), não por webhook.
app.post("/webhook/pix", (req, res) => {
  handleWebhook(req, res, bot);
});

app.get("/webhook/pix", (req, res) => {
  handleWebhook(req, res, bot);
});

const servidor = app.listen(config.port, () => {
  console.log(`🌐 Servidor HTTP rodando na porta ${config.port}`);
});

// Porta ocupada = quase sempre uma segunda instância do MESMO bot. Em vez de
// morrer com exceção e deixar dois bots brigando pelo Telegram, avisa e sai.
servidor.on("error", (err) => {
  if (err && err.code === "EADDRINUSE") {
    console.error(
      `🔒 A porta ${config.port} já está em uso — o ${config.botName} já está rodando em outro terminal/PM2. ` +
        "Feche a outra instância antes de subir esta."
    );
    process.exit(1);
  }
  console.error("[servidor]", err?.message || err);
});

// ---------------------------------------------------------------------------
// Rede oscila: um ECONNRESET na hora do getMe não pode derrubar o bot para
// sempre. Aqui a conexão com o Telegram é retentada de tempos em tempos.
// ---------------------------------------------------------------------------
function dormir(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function iniciarBot() {
  for (let tentativa = 1; ; tentativa++) {
    try {
      // O segundo parâmetro roda quando a conexão fica pronta (o launch em si
      // fica pendurado no polling e nunca "termina").
      await bot.launch({}, () => {
        console.log(`🤖 ${config.botName} (@${bot.botInfo?.username}) conectado — aguardando mensagens...`);
      });
      console.log("⚠️  O polling terminou — religando...");
    } catch (err) {
      const msg = String(err?.message || err);
      if (/409|Conflict/i.test(msg)) {
        console.error(
          "🔒 Outra instância deste bot está rodando com o MESMO token " +
            "(409: Conflict). Feche a outra — este aqui fica tentando assumir a cada 30s."
        );
        try {
          bot.stop("conflito");
        } catch (_) {}
        await dormir(30000);
        continue;
      }
      console.error(
        `⚠️  Falha ao conectar no Telegram (tentativa ${tentativa}): ${msg}`
      );
    }
    try {
      bot.stop("retry");
    } catch (_) {
      /* pode não estar rodando */
    }
    const espera = tentativa < 6 ? 5000 : 30000;
    console.log(`   Tentando de novo em ${espera / 1000}s...`);
    await dormir(espera);
  }
}

// Nenhuma promessa esquecida pode matar o processo.
process.on("unhandledRejection", (err) => {
  console.error("[unhandledRejection]", err?.stack || err?.message || err);
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err?.stack || err?.message || err);
});

iniciarBot();

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
