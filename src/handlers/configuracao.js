// ============================================================================
// SoberSMS — painel de CONFIGURAÇÃO do dono (tudo pelo Telegram)
// ----------------------------------------------------------------------------
// Quem roda o bot é o dono: abre ⚙️ Configurações e muda nome, imagem do
// /start, chave da API de números, operadora de pagamento e preços — sem
// tocar em código. Os valores ficam em settings.json e valem na hora.
// ============================================================================

const fs = require("fs");
const path = require("path");
const { Markup } = require("telegraf");

const config = require("../config");
const settings = require("../settings");
const state = require("../state");
const kb = require("../keyboards");
const api = require("../gotica.js");
const pagamentos = require("../pagamentos");
const userHandlers = require("./user");

// -----------------------------------------------------------------------------
// Textos
// -----------------------------------------------------------------------------

function resumo() {
  const chave = config.apiKey ? `${String(config.apiKey).slice(0, 12)}…` : "não configurada";
  const imagem = config.welcomeImage ? String(config.welcomeImage) : "nenhuma";
  return `⚙️ <b>Configurações do bot</b>

<blockquote>🤖 <b>Nome:</b> ${config.botName}
👤 <b>Assinatura:</b> ${config.ownerTag}
🖼️ <b>Imagem do /start:</b> ${imagem}
🔑 <b>API de números:</b> ${chave}
💰 <b>Pagamento:</b> ${pagamentos.nome()}
💵 <b>Preços:</b> Brasil R$ ${config.brazilPrice.toFixed(2)} fixo · fora ${config.priceMultiplier}x o custo
🏦 <b>Recarga:</b> R$ ${config.minDeposit.toFixed(2)} a R$ ${config.maxDeposit.toFixed(2)}</blockquote>

Tudo que você mudar aqui é salvo automaticamente e vale na hora.`;
}

function painelKb() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("🤖 Nome do bot", "cfg:nome")],
    [Markup.button.callback("🖼️ Imagem do /start", "cfg:imagem")],
    [Markup.button.callback("🔑 API de números (Gótica SMS)", "cfg:api")],
    [Markup.button.callback("💰 Pagamento (Pix)", "cfg:pagamento")],
    [Markup.button.callback("💵 Preços e limites", "cfg:precos")],
    [Markup.button.callback("📚 Tutorial passo a passo", "cfg:tutorial")],
    [Markup.button.callback("⬅️ Voltar", "admin:panel")],
  ]);
}

const TUTORIAL = `📚 <b>Como colocar seu bot no ar</b> — passo a passo

<blockquote><b>1️⃣ Crie seu bot no Telegram</b>
• Abra o <b>@BotFather</b> e mande <code>/newbot</code>
• Escolha o nome (ex: <i>Meu Bot SMS</i>) e o usuário (ex: <i>meu_bot_sms</i>)
• Ele vai devolver um <b>token</b> — copie

<b>2️⃣ Coloque o token no bot</b>
• Abra o arquivo <code>.env</code> deste bot
• Cole na linha <code>BOT_TOKEN=seu_token_aqui</code>
• Salve

<b>3️⃣ Suba o bot</b>
• No terminal: <code>npm start</code>
• Pronto: <code>🤖 Bot conectado — aguardando mensagens…</code>

<b>4️⃣ Assuma como dono</b>
• Abra o seu bot no Telegram e mande <code>/start</code>
• Pronto, você é o dono: o bot reconhece o primeiro usuário

<b>5️⃣ Configure pelo Telegram</b>
• Menu → <b>⚙️ Configurações</b>
• Coloque sua <b>chave da API de números</b> (gsk_live_…)
• Escolha o <b>pagamento</b> (MisticPay ou Mercado Pago) e cole as credenciais
• Ajuste o <b>nome</b>, a <b>imagem do /start</b> e os <b>preços</b> se quiser

<b>6️⃣ Pronto para vender</b>
• Seus clientes usam <code>/servicos</code> para comprar números
• Você lucra em cada ativação — o valor entra no seu saldo de pagamento</blockquote>

Precisa de ajuda? <b>/suporte</b> fala comigo.`;

// -----------------------------------------------------------------------------
// Teclado de escolhas
// -----------------------------------------------------------------------------

function pagamentoKb() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("💠 MisticPay", "cfg:pagamento:misticpay")],
    [Markup.button.callback("💳 Mercado Pago", "cfg:pagamento:mercadopago")],
    [Markup.button.callback("⬅️ Voltar", "admin:config")],
  ]);
}

// -----------------------------------------------------------------------------
// Registro dos handlers
// -----------------------------------------------------------------------------

function register(bot) {
  const ehDono = (ctx) => {
    if (config.ehDono(ctx.from.id)) return true;
    ctx.answerCbQuery?.("Apenas o dono do bot pode configurar.", { show_alert: true });
    return false;
  };

  // --- painel ---
  bot.action("admin:config", async (ctx) => {
    if (!ehDono(ctx)) return;
    await ctx.answerCbQuery();
    await ctx.editMessageText(resumo(), {
      parse_mode: "HTML",
      ...painelKb(),
    }).catch(async () => {
      await ctx.replyWithHTML(resumo(), painelKb());
    });
  });

  // --- nome do bot ---
  bot.action("cfg:nome", async (ctx) => {
    if (!ehDono(ctx)) return;
    state.setState(ctx.from.id, "cfg_nome", {});
    await ctx.answerCbQuery();
    await ctx.replyWithHTML(
      "🤖 <b>Nome do bot</b>\n\nDigite o novo nome (ex: <i>Meu Bot SMS</i>).",
      kb.backButton("admin:config")
    );
  });

  bot.action("cfg:assinatura", async (ctx) => {
    if (!ehDono(ctx)) return;
    state.setState(ctx.from.id, "cfg_assinatura", {});
    await ctx.answerCbQuery();
    await ctx.replyWithHTML(
      "👤 <b>Assinatura</b>\n\nDigite como você quer aparecer (ex: <i>Dev Soberano</i>).",
      kb.backButton("admin:config")
    );
  });

  // --- imagem do /start ---
  bot.action("cfg:imagem", async (ctx) => {
    if (!ehDono(ctx)) return;
    state.setState(ctx.from.id, "cfg_imagem", {});
    await ctx.answerCbQuery();
    await ctx.replyWithHTML(
      "🖼️ <b>Imagem do /start</b>\n\nMande a imagem que deve aparecer quando o cliente abre o bot.\n\n<blockquote>📎 <b>Dica:</b> envie como <b>arquivo</b> para manter a qualidade total. Foto comum chega comprimida.</blockquote>",
      kb.backButton("admin:config")
    );
  });

  // --- API de números ---
  bot.action("cfg:api", async (ctx) => {
    if (!ehDono(ctx)) return;
    state.setState(ctx.from.id, "cfg_api", {});
    await ctx.answerCbQuery();
    await ctx.replyWithHTML(
      "🔑 <b>API de números</b>\n\nCole sua chave (começa com <code>gsk_live_</code>).\n\n" +
        "Pegue no painel do seu site → botão <b>🔌 API</b> → <i>Minha chave</i>.",
      kb.backButton("admin:config")
    );
  });

  // --- pagamento ---
  bot.action("cfg:pagamento", async (ctx) => {
    if (!ehDono(ctx)) return;
    await ctx.answerCbQuery();
    await ctx.replyWithHTML(
      `💰 <b>Operadora de pagamento</b>\n\nQual vai receber as recargas dos seus clientes?\n\n<blockquote>Em uso agora: <b>${pagamentos.nome()}</b></blockquote>`,
      pagamentoKb()
    );
  });

  bot.action(/^cfg:pagamento:(misticpay|mercadopago)$/, async (ctx) => {
    if (!ehDono(ctx)) return;
    const escolha = ctx.match[1];
    settings.set("pagamento", escolha);
    await ctx.answerCbQuery("Salvo: " + (escolha === "mercadopago" ? "Mercado Pago" : "MisticPay"));
    state.setState(ctx.from.id, "cfg_pagamento_chave", { provedor: escolha });
    await ctx.replyWithHTML(
      escolha === "mercadopago"
        ? "💳 <b>Mercado Pago</b> escolhido.\n\nCole seu <b>Access Token</b> (inicia com <code>APP_USR-</code>).\n\n<i>Produção → Suas integrações → Access Token.</i>"
        : "💠 <b>MisticPay</b> escolhido.\n\nCole suas chaves no formato <code>CLIENT_ID:CLIENT_SECRET</code>.\n\n<i>Painel MisticPay → API → Chaves de Acesso.</i>",
      kb.backButton("admin:config")
    );
  });

  // --- preços ---
  bot.action("cfg:precos", async (ctx) => {
    if (!ehDono(ctx)) return;
    await ctx.answerCbQuery();
    await ctx.replyWithHTML(
      `💵 <b>Preços e limites</b>\n\n<blockquote>🇧🇷 Brasil: <b>R$ ${config.brazilPrice.toFixed(2)}</b> fixo\n🌍 Fora do Brasil: <b>${config.priceMultiplier}x</b> o custo\n🏦 Recarga: R$ ${config.minDeposit.toFixed(2)} a R$ ${config.maxDeposit.toFixed(2)}</blockquote>\n\nO que quer mudar?`,
      Markup.inlineKeyboard([
        [Markup.button.callback("🇧🇷 Preço do Brasil", "cfg:preco_br")],
        [Markup.button.callback("🌍 Multiplicador fora do Brasil", "cfg:preco_mult")],
        [Markup.button.callback("🏦 Valor mínimo da recarga", "cfg:preco_min")],
        [Markup.button.callback("⬅️ Voltar", "admin:config")],
      ])
    );
  });

  bot.action("cfg:preco_br", async (ctx) => {
    if (!ehDono(ctx)) return;
    state.setState(ctx.from.id, "cfg_preco_br", {});
    await ctx.answerCbQuery();
    await ctx.replyWithHTML(
      `🇧🇷 <b>Preço do Brasil</b>\n\nDigite o novo valor (ex: <code>13</code> ou <code>13.50</code>).\n\nAtual: R$ ${config.brazilPrice.toFixed(2)}`,
      kb.backButton("admin:config")
    );
  });

  bot.action("cfg:preco_mult", async (ctx) => {
    if (!ehDono(ctx)) return;
    state.setState(ctx.from.id, "cfg_preco_mult", {});
    await ctx.answerCbQuery();
    await ctx.replyWithHTML(
      `🌍 <b>Multiplicador</b>\n\nQuanto o cliente paga fora do Brasil, em vezes o custo.\nEx: <code>2</code> = dobro · <code>3</code> = triplo\n\nAtual: ${config.priceMultiplier}x`,
      kb.backButton("admin:config")
    );
  });

  bot.action("cfg:preco_min", async (ctx) => {
    if (!ehDono(ctx)) return;
    state.setState(ctx.from.id, "cfg_preco_min", {});
    await ctx.answerCbQuery();
    await ctx.replyWithHTML(
      `🏦 <b>Recarga mínima</b>\n\nDigite o menor valor que um cliente pode recarregar (ex: <code>5</code>).\n\nAtual: R$ ${config.minDeposit.toFixed(2)}`,
      kb.backButton("admin:config")
    );
  });

  // --- tutorial ---
  bot.action("cfg:tutorial", async (ctx) => {
    if (!ehDono(ctx)) return;
    await ctx.answerCbQuery();
    await ctx.replyWithHTML(TUTORIAL, kb.backButton("admin:config"));
  });

  // -----------------------------------------------------------------------------
  // Entrada de dados (texto e foto)
  // -----------------------------------------------------------------------------

  bot.on("text", async (ctx, next) => {
    const s = state.getState(ctx.from.id);
    if (!s || !String(s.step).startsWith("cfg_")) return next();
    if (!config.ehDono(ctx.from.id)) {
      state.clearState(ctx.from.id);
      return;
    }

    const texto = (ctx.message.text || "").trim();
    const salvarEConfirmar = async (chave, valor, msg) => {
      settings.set(chave, valor);
      state.clearState(ctx.from.id);
      await ctx.replyWithHTML(`✅ ${msg}`, kb.backButton("admin:config"));
    };

    switch (s.step) {
      case "cfg_nome":
        if (!texto || texto.length > 40) {
          await ctx.reply("⚠️ Mande um nome de até 40 caracteres.");
          return;
        }
        await salvarEConfirmar("botName", texto, `Nome do bot agora é <b>${texto}</b>.`);
        return;

      case "cfg_assinatura":
        await salvarEConfirmar("ownerTag", texto || "Dev Soberano", `Assinatura agora é <b>${texto || "Dev Soberano"}</b>.`);
        return;

      case "cfg_api": {
        const chave = texto.replace(/^["'\s]+|["'\s]+$/g, "");
        if (!/^gsk_(live|test)_/i.test(chave)) {
          await ctx.reply("⚠️ Essa não parece uma chave válida (precisa começar com gsk_live_).");
          return;
        }
        const anterior = config.apiKey;
        settings.set("apiKey", chave);
        try {
          const perfil = await api.getProfile();
          await ctx.replyWithHTML(
            `✅ Chave aceita! Conexão com a API <b>ok</b>.\n\n<blockquote>💰 Saldo na API: R$ ${Number(perfil.balance || 0).toFixed(2)}</blockquote>`,
            kb.backButton("admin:config")
          );
        } catch (e) {
          settings.set("apiKey", anterior);
          await ctx.reply(`⚠️ A chave foi recusada: ${e.message}\n\nO valor anterior foi mantido.`);
        }
        state.clearState(ctx.from.id);
        return;
      }

      case "cfg_pagamento_chave": {
        const provedor = s.data && s.data.provedor === "mercadopago" ? "mercadopago" : "misticpay";
        if (provedor === "mercadopago") {
          const token = texto.replace(/^["'\s]+|["'\s]+$/g, "");
          if (!/^APP_USR-/.test(token)) {
            await ctx.reply("⚠️ O Access Token do Mercado Pago começa com APP_USR-.");
            return;
          }
          await salvarEConfirmar("mpAccessToken", token, "Access Token do Mercado Pago salvo.");
        } else {
          const partes = texto.split(/[:\s]+/).map((x) => x.trim()).filter(Boolean);
          if (partes.length < 2) {
            await ctx.reply("⚠️ Mande no formato CLIENT_ID:CLIENT_SECRET.");
            return;
          }
          settings.set("misticClientId", partes[0]);
          await salvarEConfirmar("misticClientSecret", partes[1], "Credenciais da MisticPay salvas.");
        }
        return;
      }

      case "cfg_preco_br": {
        const v = Number(texto.replace(",", "."));
        if (!Number.isFinite(v) || v <= 0) {
          await ctx.reply("⚠️ Digite um valor maior que zero, ex: 13");
          return;
        }
        await salvarEConfirmar("brazilPrice", v, `Preço do Brasil agora é <b>R$ ${v.toFixed(2)}</b>.`);
        return;
      }

      case "cfg_preco_mult": {
        const v = Number(texto.replace(",", "."));
        if (!Number.isFinite(v) || v < 1) {
          await ctx.reply("⚠️ Digite um multiplicador de 1 pra cima, ex: 2");
          return;
        }
        await salvarEConfirmar("priceMultiplier", v, `Fora do Brasil agora é <b>${v}x</b> o custo.`);
        return;
      }

      case "cfg_preco_min": {
        const v = Number(texto.replace(",", "."));
        if (!Number.isFinite(v) || v < 1) {
          await ctx.reply("⚠️ Digite um valor de R$ 1 pra cima, ex: 5");
          return;
        }
        await salvarEConfirmar("minDeposit", v, `Recarga mínima agora é <b>R$ ${v.toFixed(2)}</b>.`);
        return;
      }

      default:
        state.clearState(ctx.from.id);
        return;
    }
  });

  // imagem do /start: aceita foto OU arquivo (arquivo preserva a qualidade)
  const salvarImagem = async (ctx) => {
    const s = state.getState(ctx.from.id);
    if (!s || s.step !== "cfg_imagem") return false;
    if (!config.ehDono(ctx.from.id)) {
      state.clearState(ctx.from.id);
      return true;
    }

    try {
      const msg = ctx.message;
      let fileId = null;

      if (msg.document && /^image\//.test(msg.document.mime_type || "")) {
        fileId = msg.document.file_id; // arquivo = qualidade original
      } else if (msg.photo && msg.photo.length) {
        fileId = msg.photo[msg.photo.length - 1].file_id; // maior versão da foto
      } else {
        await ctx.reply(
          "⚠️ Preciso de uma imagem. Para qualidade total, envie como ARQUIVO (📎)."
        );
        return true;
      }

      const link = await ctx.telegram.getFileLink(fileId);
      const pasta = path.resolve(process.cwd(), "assets");
      if (!fs.existsSync(pasta)) fs.mkdirSync(pasta, { recursive: true });

      const destino = path.join(pasta, "welcome.jpg");
      const resp = await fetch(link.href);
      const buffer = Buffer.from(await resp.arrayBuffer());
      if (!buffer.length) throw new Error("arquivo veio vazio");
      fs.writeFileSync(destino, buffer);

      settings.set("welcomeImage", "assets/welcome.jpg");
      userHandlers.resetWelcomeImage(); // mata o cache da imagem antiga
      state.clearState(ctx.from.id);

      await ctx.replyWithPhoto(
        { source: destino },
        {
          caption: `✅ Imagem do /start atualizada! (${Math.round(buffer.length / 1024)} KB)\n\nMande /start para ver como ficou.`,
          ...kb.backButton("admin:config"),
        }
      );
    } catch (e) {
      console.error("[config] erro ao salvar imagem:", e.message);
      await ctx.reply("⚠️ Não consegui salvar essa imagem. Tente enviar como ARQUIVO (📎).");
    }
    return true;
  };

  bot.on("photo", async (ctx, next) => {
    if (await salvarImagem(ctx)) return;
    return next();
  });

  bot.on("document", async (ctx, next) => {
    if (await salvarImagem(ctx)) return;
    return next();
  });
}

module.exports = { register, resumo, TUTORIAL };
