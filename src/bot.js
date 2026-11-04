const { Telegraf } = require("telegraf");
const config = require("./config");
const userHandlers = require("./handlers/user");
const configHandlers = require("./handlers/configuracao");
const adminHandlers = require("./handlers/admin");

// Valida se o token existe antes de iniciar
if (!config.botToken) {
  console.error("❌ Erro: O token do bot não foi definido no arquivo config.js ou nas variáveis de ambiente!");
  process.exit(1);
}

const bot = new Telegraf(config.botToken);

// SÓ PRIVADO: em grupo o bot não responde absolutamente nada. Motivo: chave de
// API, saldo, pedidos e configuração são assunto entre o bot e o dono/cliente —
// num grupo isso vaza para todo mundo, e alguém podia mandar uma chave (verdadeira
// ou falsa) que o bot aceitaria sem querer.
bot.use(async (ctx, next) => {
  if (ctx.chat && ctx.chat.type !== "private") return;
  return next();
});

configHandlers.register(bot); // antes: estados "cfg_*" são dele
adminHandlers.register(bot);
userHandlers.register(bot);

bot.catch((err, ctx) => {
  console.error(`Erro no bot para update ${ctx.updateType}:`, err);
});

module.exports = bot;