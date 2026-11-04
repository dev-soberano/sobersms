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

configHandlers.register(bot); // antes: estados "cfg_*" são dele
adminHandlers.register(bot);
userHandlers.register(bot);

bot.catch((err, ctx) => {
  console.error(`Erro no bot para update ${ctx.updateType}:`, err);
});

module.exports = bot;