/**
 * ╔═╗ ╔═╗ ╔╗  ╔══ ╔═╗ ╔═╗ ╔╦╗ ╔═╗
 * ╚═╗ ║ ║ ╠╩╗ ╠═  ╠╦╝ ╚═╗ ║║║ ╚═╗
 * ╚═╝ ╚═╝ ╚═╝ ╚══ ╩╚═ ╚═╝ ╩ ╩ ╚═╝
 * @author Dev Soberano
 * @link https://github.com/dev-soberano
 * @project SoberSMS
 */
const path = require("path");
const fs = require("fs");
const { Markup } = require("telegraf");
const db = require("../db");
const kb = require("../keyboards");
const texts = require("../texts");
const config = require("../config");
const state = require("../state");
const mp = require("../pagamentos");
const api = require("../gotica");

function isAdmin(userId) {
  return config.ehDono(userId);
}

const lastMenuMsgId = new Map();

function trackMenuMessage(ctx, message) {
  if (message && message.message_id) {
    lastMenuMsgId.set(ctx.from.id, message.message_id);
  }
}

async function deleteTrackedMenuMessage(ctx) {
  const msgId = lastMenuMsgId.get(ctx.from.id);
  if (msgId) {
    try {
      await ctx.telegram.deleteMessage(ctx.chat.id, msgId);
    } catch (e) {}
    lastMenuMsgId.delete(ctx.from.id);
  }
}
function productLabel(code) {
  const found = config.smsProducts.find((p) => p.code === code);
  return found ? found.label : `📱 ${code}`;
}

let welcomeImageFileId = null;

// Quando o dono troca a imagem, o cache da antiga precisa morrer — senão o
// bot continua mandando a imagem de antes (parecia que não atualizava).
function resetWelcomeImage() {
  welcomeImageFileId = null;
}

// A imagem do /start é escolhida pelo dono no painel (⚙️ Configurações).
// Se o arquivo não existir, o bot manda só o texto.
async function getWelcomeImage() {
  if (welcomeImageFileId) return welcomeImageFileId;
  const caminho = path.resolve(process.cwd(), config.welcomeImage || "assets/bah.png");
  return fs.existsSync(caminho) ? { source: caminho } : null;
}

async function isCurrentMessagePhoto(ctx) {
  return !!(ctx.callbackQuery && ctx.callbackQuery.message && ctx.callbackQuery.message.photo);
}


async function renderText(ctx, text, extra = {}) {
  await deleteTrackedMenuMessage(ctx);
  if (await isCurrentMessagePhoto(ctx)) {
    await ctx.deleteMessage().catch(() => {});
    const sent = await ctx.replyWithHTML(text, extra);
    trackMenuMessage(ctx, sent);
    return;
  }
  try {
    await ctx.editMessageText(text, { parse_mode: "HTML", ...extra });
    trackMenuMessage(ctx, ctx.callbackQuery.message);
  } catch (err) {
    if (!err.description || !err.description.includes("message is not modified")) {
      await ctx.deleteMessage().catch(() => {});
      const sent = await ctx.replyWithHTML(text, extra);
      trackMenuMessage(ctx, sent);
    }
  }
}

async function renderHome(ctx, text, extra = {}) {
  await deleteTrackedMenuMessage(ctx);
  if (ctx.updateType === "callback_query") {
    await ctx.deleteMessage().catch(() => {});
  }
  const imagem = await getWelcomeImage();
  const sent = imagem
    ? await ctx.replyWithPhoto(imagem, { caption: text, parse_mode: "HTML", ...extra })
    : await ctx.replyWithHTML(text, extra);
  if (imagem && !welcomeImageFileId && sent.photo && sent.photo.length) {
    welcomeImageFileId = sent.photo[sent.photo.length - 1].file_id;
  }
  trackMenuMessage(ctx, sent);
}

async function clearReplyKeyboard(ctx) {
  try {
    const msg = await ctx.reply("⌛", Markup.removeKeyboard());
    await ctx.deleteMessage(msg.message_id);
  } catch (e) {
    
  }
}

async function deletePrevListMessage(ctx) {
  const s = state.getState(ctx.from.id);
  const msgId = s?.data?.listMsgId;
  if (msgId) {
    try {
      await ctx.telegram.deleteMessage(ctx.chat.id, msgId);
    } catch (e) {
      
    }
  }
}

function register(bot) {

  bot.telegram.setMyCommands([
    { command: "start", description: "Abrir o menu principal" },
    { command: "menu", description: "Abrir o menu principal" },
    { command: "servicos", description: "Comprar número virtual para SMS" },
    { command: "paises", description: "Ver preços por país" },
    { command: "perfil", description: "Ver seu perfil" },
    { command: "saldo", description: "Ver seu saldo" },
    { command: "recarga", description: "Adicionar saldo via Pix" },
    { command: "afiliados", description: "Programa de afiliados" },
    { command: "historico", description: "Histórico de pedidos" },
    { command: "numeros", description: "Últimos números comprados" },
    { command: "cupom", description: "Aplicar um cupom de desconto" },
    { command: "suporte", description: "Falar com o suporte" },
    { command: "termos", description: "Termos de uso" },
    { command: "ajuda", description: "Como usar o bot" },
    { command: "cancelar", description: "Cancelar operação atual" },
  ]);

 
  bot.start(async (ctx) => {
    const payload = ctx.startPayload;
    let referredBy = null;
    if (payload && /^\d+$/.test(payload)) {
      const refId = Number(payload);
      if (refId !== ctx.from.id) referredBy = refId;
    }
    db.createUser(ctx.from.id, ctx.from.username, referredBy);
    state.clearState(ctx.from.id);

    // Quem instala o bot é o dono: o primeiro usuário assume a posse.
    const assumiu = config.reivindicar(ctx.from.id);

    await renderHome(ctx, texts.welcome(), kb.mainMenu(isAdmin(ctx.from.id)));

    if (assumiu) {
      await ctx.replyWithHTML(
        "👑 <b>Você é o dono deste bot!</b>\n\n" +
          "<blockquote>Abra o menu e clique em <b>⚙️ Configurações</b> para colocar sua chave da API de números, o pagamento e o nome do bot. Tudo pelo Telegram, sem mexer em código.</blockquote>",
        kb.backButton("admin:config")
      );
    }
  });

  bot.command("menu", async (ctx) => {
    state.clearState(ctx.from.id);
    await renderHome(ctx, texts.welcome(), kb.mainMenu(isAdmin(ctx.from.id)));
  });

  bot.command("cancelar", async (ctx) => {
    state.clearState(ctx.from.id);
    await ctx.reply("✅ Operação cancelada.");
  });

  bot.command("servicos", async (ctx) => showSmsProducts(ctx));

  bot.command("paises", async (ctx) => {
    const arg = (ctx.message.text.split(/\s+/)[1] || "").toLowerCase();
    const produto = config.smsProducts.some((p) => p.code === arg) ? arg : "whatsapp";
    try {
      await api.ensureCountryMeta();
      const paises = await api.listCountriesForProduct(produto);
      const linhas = paises
        .sort((a, b) => a.priceBrl - b.priceBrl)
        .slice(0, 30)
        .map((c) => `${api.countryLabel(c.country)} — R$ ${c.priceBrl.toFixed(2)}`);
      await ctx.replyWithHTML(
        `💰 <b>Preços de ${productLabel(produto)} por país</b>\n\n<blockquote>${linhas.join("\n")}</blockquote>\n\n` +
          `Use <code>/paises telegram</code> (ou outro serviço) para ver mais.`
      );
    } catch (e) {
      console.error("Erro no /paises:", e.message);
      await ctx.reply("⚠️ Erro ao consultar preços. Tente novamente.");
    }
  });

bot.command("perfil", async (ctx) => {
    const user = db.getUser(ctx.from.id);
    if (!user) return ctx.reply("Use /start primeiro.");
    await deleteTrackedMenuMessage(ctx);
    const sent = await ctx.replyWithHTML(
      texts.profileText(user, ctx.from.username),
      kb.backButton()
    );
    trackMenuMessage(ctx, sent);
  });

  bot.command("saldo", async (ctx) => {
    const user = db.getUser(ctx.from.id);
    if (!user) return ctx.reply("Use /start primeiro.");
    await deleteTrackedMenuMessage(ctx);
    const sent = await ctx.reply(`💰 Seu saldo atual: R$ ${user.balance.toFixed(2)}`);
    trackMenuMessage(ctx, sent);
  });

  bot.command("afiliados", async (ctx) => {
    const user = db.getUser(ctx.from.id);
    if (!user) return ctx.reply("Use /start primeiro.");
    const me = await ctx.telegram.getMe();
    await deleteTrackedMenuMessage(ctx);
    const sent = await ctx.replyWithHTML(
      texts.affiliatesText(me.username, user),
      kb.affiliatesKb()
    );
    trackMenuMessage(ctx, sent);
  });

  bot.command("historico", async (ctx) => {
    const orders = db.listUserOrders(ctx.from.id);
    await deleteTrackedMenuMessage(ctx);
    const sent = await ctx.replyWithHTML(texts.orderHistoryText(orders), kb.backButton());
    trackMenuMessage(ctx, sent);
  });

  bot.command("numeros", async (ctx) => {
    const orders = db.listUserSmsOrders(ctx.from.id, 10);
    await deleteTrackedMenuMessage(ctx);
    const sent = await ctx.replyWithHTML(
      texts.smsHistoryText(orders, productLabel, api.countryLabel),
      kb.backButton()
    );
    trackMenuMessage(ctx, sent);
  });

  bot.command("termos", async (ctx) => {
    await deleteTrackedMenuMessage(ctx);
    const sent = await ctx.replyWithHTML(texts.TERMS, kb.backButton());
    trackMenuMessage(ctx, sent);
  });

  bot.command("ajuda", async (ctx) => {
    await deleteTrackedMenuMessage(ctx);
    const sent = await ctx.replyWithHTML(texts.HOWTO, kb.backButton());
    trackMenuMessage(ctx, sent);
  });

  bot.command("recarga", async (ctx) => startRecharge(ctx));

  bot.command("cupom", async (ctx) => {
    const parts = ctx.message.text.split(" ");
    if (parts.length < 2) {
      state.setState(ctx.from.id, "coupon_code_wait", {});
      await ctx.reply(
        "🎟️ Digite o código do cupom que deseja aplicar na sua próxima compra:"
      );
      return;
    }
    const code = parts[1].toUpperCase();
    const coupon = db.getCoupon(code);
    if (!coupon) {
      await ctx.reply("⚠️ Cupom inválido ou expirado.");
      return;
    }
    state.setState(ctx.from.id, "idle", { activeCoupon: code });
    const desc =
      coupon.type === "percent" ? `${coupon.value}% de desconto` : `R$ ${coupon.value.toFixed(2)} de desconto`;
    await ctx.reply(
      `✅ Cupom <b>${code}</b> aplicado (${desc})! Ele será usado na sua próxima compra.`,
      { parse_mode: "HTML" }
    );
  });

  bot.command("suporte", async (ctx) => {
    state.setState(ctx.from.id, "support_wait_message", {});
    await ctx.reply(
      "🆘 Descreva sua dúvida ou problema. Sua mensagem será encaminhada para a equipe:"
    );
  });

  bot.action("menu:home", async (ctx) => {
    state.clearState(ctx.from.id);
    await renderHome(ctx, texts.welcome(), kb.mainMenu(isAdmin(ctx.from.id)));
    await ctx.answerCbQuery();
  });

  bot.action("menu:about", async (ctx) => {
    await renderText(ctx, texts.about(), kb.backButton());
    await ctx.answerCbQuery();
  });

  bot.action("menu:howto", async (ctx) => {
    await renderText(ctx, texts.HOWTO, kb.backButton());
    await ctx.answerCbQuery();
  });

  bot.action("menu:terms", async (ctx) => {
    await renderText(ctx, texts.TERMS, kb.backButton());
    await ctx.answerCbQuery();
  });

  bot.action("menu:history", async (ctx) => {
    const orders = db.listUserOrders(ctx.from.id);
    await renderText(ctx, texts.orderHistoryText(orders), kb.backButton());
    await ctx.answerCbQuery();
  });

  bot.action("menu:coupon", async (ctx) => {
    state.setState(ctx.from.id, "coupon_code_wait", {});
    await renderText(
      ctx,
      "🎟️ Digite o código do cupom que deseja aplicar na sua próxima compra:",
      kb.backButton()
    );
    await ctx.answerCbQuery();
  });

  bot.action("menu:support", async (ctx) => {
    state.setState(ctx.from.id, "support_wait_message", {});
    await renderText(
      ctx,
      "🆘 Descreva sua dúvida ou problema. Sua mensagem será encaminhada para a equipe:",
      kb.backButton()
    );
    await ctx.answerCbQuery();
  });

 

  bot.action("menu:profile", async (ctx) => {
    const user = db.getUser(ctx.from.id);
    await renderText(ctx, texts.profileText(user, ctx.from.username), kb.backButton());
    await ctx.answerCbQuery();
  });


  bot.action("menu:affiliates", async (ctx) => {
    const user = db.getUser(ctx.from.id);
    const me = await ctx.telegram.getMe();
    await renderText(ctx, texts.affiliatesText(me.username, user), kb.affiliatesKb());
    await ctx.answerCbQuery();
  });

  bot.action("aff:copy", async (ctx) => {
    const me = await ctx.telegram.getMe();
    const link = `https://t.me/${me.username}?start=${ctx.from.id}`;
    await ctx.answerCbQuery(`Link: ${link}`, { show_alert: true });
  });


  bot.action("menu:services", async (ctx) => showSmsProducts(ctx));


  bot.action(/^smsproduct:([a-z0-9_]+)$/i, async (ctx) => {
    const product = ctx.match[1].toLowerCase();
    await ctx.answerCbQuery();
    await showSmsCountries(ctx, product, 0);
  });

  bot.action(/^smsgo:([a-z0-9_]+):([a-z]+)$/i, async (ctx) => {
    const product = ctx.match[1];
    const country = ctx.match[2];

    const user = db.getUser(ctx.from.id);
    if (!user) {
      await ctx.answerCbQuery("Use /start primeiro.", { show_alert: true });
      return;
    }

    await ctx.answerCbQuery("⏳ Processando...");

    let priceInfo;
    try {
      priceInfo = await api.getCheapestForCountry(product, country);
    } catch (err) {
      console.error("Erro na API de números (preço):", err.message);
      await ctx.reply("⚠️ Erro ao consultar a API. Tente novamente.");
      return;
    }

    if (!priceInfo || !priceInfo.count) {
      await ctx.reply("⚠️ Esse número acabou de esgotar. Escolha outro país.");
      return;
    }

    if (user.balance < priceInfo.priceBrl) {
      await ctx.reply(
        `⚠️ Saldo insuficiente. Você precisa de R$ ${priceInfo.priceBrl.toFixed(
          2
        )} e tem R$ ${user.balance.toFixed(2)}.\n\nUse 💎 Recarga pra adicionar saldo.`
      );
      return;
    }

    let order;
    try {
      order = await api.buyActivation(country, product, priceInfo.costRub);
    } catch (err) {
      console.error("Erro ao comprar número na API:", err.message);
      await ctx.reply(
        "⚠️ Numero Esgotado. Tente outro país ou tente de novo em instantes."
      );
      return;
    }

    db.updateBalance(ctx.from.id, -priceInfo.priceBrl);
    db.createSmsOrder({
      userId: ctx.from.id,
      apiId: order.id,
      product,
      country,
      phone: order.phone,
      priceBrl: priceInfo.priceBrl,
      maxPriceRub: priceInfo.costRub,
    });

    await ctx.replyWithHTML(
      texts.smsOrderText({
        phone: order.phone,
        label: productLabel(product),
        countryLabel: api.countryLabel(country),
        priceBrl: priceInfo.priceBrl,
        status: "PENDING",
        lastCode: null,
        expiresAt: Date.now() + 15 * 60 * 1000,
      }),
      kb.smsOrderKb(order.id, true, order.phone)
    );
  });

  bot.action(/^smscheck:(.+)$/, async (ctx) => {
    const apiId = String(ctx.match[1]);
    const localOrder = db.getSmsOrder(apiId);
    if (!localOrder) {
      await ctx.answerCbQuery("Pedido não encontrado.", { show_alert: true });
      return;
    }

    let remote;
    try {
      remote = await api.checkOrder(apiId);
    } catch (err) {
      console.error("Erro ao checar pedido na API:", err.message);
      await ctx.answerCbQuery("Erro ao consultar status.", { show_alert: true });
      return;
    }

    const smsList = remote.sms || [];
    const lastCode = smsList.length ? smsList[smsList.length - 1].code : null;

    db.updateSmsOrder(apiId, {
      status: remote.status,
      sms_count: smsList.length,
      last_code: lastCode,
    });

    if (["TIMEOUT", "BANNED"].includes(remote.status) && !smsList.length) {
      db.refundSmsOrder(apiId);
      db.updateSmsOrder(apiId, { done: 1 });
    } else if (["CANCELED", "FINISHED"].includes(remote.status)) {
      db.updateSmsOrder(apiId, { done: 1 });
    }


    try {
      await ctx.editMessageText(
        texts.smsOrderText({
          phone: localOrder.phone,
          label: productLabel(localOrder.product),
          countryLabel: api.countryLabel(localOrder.country),
          priceBrl: localOrder.price_brl,
          status: remote.status,
          lastCode,
          expiresAt: localOrder.created_at + 15 * 60 * 1000,
        }),
        {
          parse_mode: "HTML",
          ...(lastCode
            ? kb.smsCodeKb(apiId, lastCode, localOrder.phone)
            : kb.smsOrderKb(
                apiId,
                !smsList.length && remote.status === "PENDING",
                localOrder.phone
              )),
        }
      );
    } catch (error) {

      if (!error.description || !error.description.includes("message is not modified")) {
        console.error("Erro ao editar mensagem de checagem de SMS:", error.message);
      }
    }

    await ctx.answerCbQuery(lastCode ? "✅ Código recebido!" : "⏳ Ainda sem SMS.");
  });

  bot.action(/^smscancel:(.+)$/, async (ctx) => {
    const apiId = String(ctx.match[1]);
    const localOrder = db.getSmsOrder(apiId);
    if (!localOrder) {
      await ctx.answerCbQuery("Pedido não encontrado.", { show_alert: true });
      return;
    }

    try {
      await api.cancelOrder(apiId);
    } catch (err) {
      console.error("Erro ao cancelar pedido na API:", err.message);
      await ctx.answerCbQuery(
        "Não foi possível cancelar (talvez já tenha chegado SMS).",
        { show_alert: true }
      );
      return;
    }

    db.refundSmsOrder(apiId);
    db.updateSmsOrder(apiId, { status: "CANCELED", done: 1 });

    await ctx.editMessageText(
      texts.smsOrderText({
        phone: localOrder.phone,
        label: productLabel(localOrder.product),
        countryLabel: api.countryLabel(localOrder.country),
        priceBrl: localOrder.price_brl,
        status: "CANCELED",
        lastCode: localOrder.last_code,
      }),
      { parse_mode: "HTML", ...kb.smsOrderKb(apiId, false, localOrder.phone) }
    );
    await ctx.answerCbQuery("❌ Pedido cancelado e saldo devolvido.", {
      show_alert: true,
    });
  });

  bot.action("menu:recharge", async (ctx) => startRecharge(ctx));

  bot.action(/^recharge_amt:(.+)$/, async (ctx) => {
    const value = ctx.match[1];
    if (value === "custom") {
      state.setState(ctx.from.id, "recharge_amount_wait", {});
      await renderText(
        ctx,
        "✏️ Digite o valor que deseja recarregar (ex: 35.00):",
        kb.backButton("menu:recharge")
      );
      await ctx.answerCbQuery();
      return;
    }
    await createAndSendPix(ctx, Number(value));
    await ctx.answerCbQuery();
  });

  bot.action(/^checkpix:(.+)$/, async (ctx) => {
    const paymentId = ctx.match[1];
    try {
      const payment = await mp.getPayment(paymentId);
      const recharge = db.getRechargeByMpPaymentId(paymentId);

      if (!recharge) {
        await ctx.answerCbQuery("Recarga não encontrada.", { show_alert: true });
        return;
      }
      if (recharge.status === "aprovada") {
        await ctx.answerCbQuery("✅ Pagamento já confirmado! Saldo creditado.", {
          show_alert: true,
        });
        return;
      }
      if (payment.status === "approved") {
        db.approveRecharge(recharge.recharge_id);
        await ctx.answerCbQuery(
          "✅ Pagamento aprovado! Seu saldo já foi atualizado.",
          { show_alert: true }
        );
      } else {
        await ctx.answerCbQuery(
          `⏳ Pagamento ainda não confirmado (status: ${payment.status}).`,
          { show_alert: true }
        );
      }
    } catch (err) {
      console.error(err);
      await ctx.answerCbQuery("Erro ao verificar pagamento.", { show_alert: true });
    }
  });



  bot.on("text", async (ctx, next) => {
    const s = state.getState(ctx.from.id);
    if (!s) return next();


    if (["sms_choose_product", "sms_choose_country"].includes(s.step)) {
      try {
        await ctx.deleteMessage();
      } catch (e) {

      }
    }

    switch (s.step) {
      case "sms_choose_product": {
        const text = ctx.message.text.trim();

      if (text === "⬅️ Voltar") {
  await deletePrevListMessage(ctx);
  state.clearState(ctx.from.id);
  await clearReplyKeyboard(ctx);
  await ctx.replyWithPhoto(await getWelcomeImage(), {
    caption: texts.welcome(),
    parse_mode: "HTML",
    ...kb.mainMenu(isAdmin(ctx.from.id)),
  });
  return;
}

        if (text === "🔎 Outro serviço") {
          state.setState(ctx.from.id, "sms_custom_product_wait", {});
          await clearReplyKeyboard(ctx);
          await ctx.reply(
            "🔎 Digite o nome do serviço em inglês (ex: spotify, openai, binance):",
            kb.backButton("menu:services")
          );
          return;
        }

        const product = kb.findSmsProductByText(config.smsProducts, text);
        if (!product) {
          await ctx.reply("⚠️ Escolha um serviço usando os botões abaixo.");
          return;
        }
        await showSmsCountries(ctx, product, 0);
        return;
      }

      case "sms_choose_country": {
        const text = ctx.message.text.trim();
        const { product, page = 0, countries = [] } = s.data || {};

        if (text === "⬅️ Voltar") {
          await showSmsProducts(ctx);
          return;
        }

        if (text === "⬅️ Anteriores") {
          await showSmsCountries(ctx, product, Math.max(0, page - 1), countries);
          return;
        }

        if (text === "Próximos ➡️") {
          await showSmsCountries(ctx, product, page + 1, countries);
          return;
        }

        const country = kb.findSmsCountryByText(countries, api.countryLabel, text);
        if (!country) {
          await ctx.reply("⚠️ Escolha um país usando os botões abaixo.");
          return;
        }

        let priceInfo;
        try {
          priceInfo = await api.getCheapestForCountry(product, country);
        } catch (err) {
          console.error("Erro na API de números (preço):", err.message);
          await ctx.reply("⚠️ Erro ao consultar preço. Tente de novo.");
          return;
        }

        if (!priceInfo || !priceInfo.count) {
          await ctx.reply("⚠️ Esgotou agora, escolha outro país.");
          return;
        }

        await deletePrevListMessage(ctx);
        state.clearState(ctx.from.id);
        await clearReplyKeyboard(ctx);
        await ctx.replyWithHTML(
          texts.smsConfirmText(
            productLabel(product),
            api.countryLabel(country),
            priceInfo.priceBrl
          ),
          kb.smsConfirmKb(product, country)
        );
        return;
      }

     case "recharge_amount_wait": {
        const amount = Number(ctx.message.text.replace(",", "."));
        if (!amount || amount <= 0) {
          await ctx.reply("⚠️ Valor inválido. Digite apenas números, ex: 35.00");
          return;
        }
        if (amount < mp.MIN_AMOUNT) {
          await ctx.reply(`⚠️ O mínimo de recarga é R$ ${mp.MIN_AMOUNT.toFixed(2)}.`);
          return;
        }
        state.clearState(ctx.from.id);
        await createAndSendPix(ctx, amount);
        return;
      }

      case "sms_custom_product_wait": {
        const product = ctx.message.text
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, "");
        state.clearState(ctx.from.id);
        if (!product) {
          await ctx.reply("⚠️ Nome inválido. Digite só letras, ex: spotify.");
          return;
        }
        await showSmsCountries(ctx, product, 0);
        return;
      }

      case "coupon_code_wait": {
        const code = ctx.message.text.trim().toUpperCase();
        const coupon = db.getCoupon(code);
        if (!coupon) {
          await ctx.reply("⚠️ Cupom inválido ou expirado. Tente novamente ou /cancelar.");
          return;
        }
        state.setState(ctx.from.id, "idle", { activeCoupon: code });
        const desc =
          coupon.type === "percent"
            ? `${coupon.value}% de desconto`
            : `R$ ${coupon.value.toFixed(2)} de desconto`;
        await ctx.reply(`✅ Cupom aplicado (${desc}) na sua próxima compra!`);
        return;
      }

      case "support_wait_message": {
        const ticketId = db.createTicket(ctx.from.id, ctx.message.text);
        state.clearState(ctx.from.id);
        await ctx.reply(
          `✅ Ticket #${ticketId} criado! Nossa equipe vai te responder em breve.`
        );
        for (const adminId of config.adminIds) {
          try {
            await ctx.telegram.sendMessage(
              adminId,
              `🆘 <b>Novo ticket de suporte #${ticketId}</b>\n\n` +
                `👤 Usuário: ${ctx.from.id} (@${ctx.from.username || "sem username"})\n\n` +
                `💬 ${ctx.message.text}\n\n` +
                `Responda com: /responder ${ticketId} sua mensagem`,
              { parse_mode: "HTML" }
            );
          } catch (e) {

          }
        }
        return;
      }

      default:
        return next();
    }
  });

  startSmsPoller(bot);
}

async function showSmsProducts(ctx) {
  const text =
    "📱 <b>Números virtuais para SMS</b>\n\nEscolha uma Plataforma:";
  const markup = kb.smsProductsKb(config.smsProducts);
if (ctx.updateType === "callback_query") {
    await ctx.answerCbQuery();
    await ctx.deleteMessage().catch(() => {});
  }

  await deleteTrackedMenuMessage(ctx);
  await deletePrevListMessage(ctx);
    
  const sent = await ctx.replyWithHTML(text, markup);
  state.setState(ctx.from.id, "sms_choose_product", { listMsgId: sent.message_id });
}

async function showSmsCountries(ctx, product, page = 0, cachedCountries = null) {
  const label = productLabel(product);
  let countries = cachedCountries;
  if (!countries || !countries.length) {
    try {
      countries = await api.listCountriesForProduct(product);
    } catch (err) {
      console.error("Erro ao consultar preços na API:", err.message);
      state.clearState(ctx.from.id);
      await clearReplyKeyboard(ctx);
      await ctx.reply(
        "⚠️ Não foi possível consultar preços agora. Tente novamente.",
        kb.backButton("menu:services")
      );
      return;
    }
  }

  if (!countries.length) {
    state.clearState(ctx.from.id);
    await clearReplyKeyboard(ctx);
    await ctx.reply(
      `⚠️ Nenhum número confiável disponível pra "${product}" no momento. Tente outro serviço, confira se digitou certo, ou tente de novo mais tarde.`,
      kb.backButton("menu:services")
    );
    return;
  }

  const text = `${texts.smsProductHeaderText(label)}\n\n${countries.length} país(es) disponível(is).`;
  const markup = kb.smsCountriesKb(product, countries, api.countryLabel, page);

  await deletePrevListMessage(ctx);
  const sent = await ctx.replyWithHTML(text, markup);
  state.setState(ctx.from.id, "sms_choose_country", {
    product,
    page,
    countries,
    listMsgId: sent.message_id,
  });
}

async function startRecharge(ctx) {
  const text =
    "💎 <b>Recarga de saldo via Pix</b>\n\nEscolha um valor ou digite outro:";
  if (ctx.updateType === "callback_query") {
    await renderText(ctx, text, kb.rechargeAmountsKb());
    await ctx.answerCbQuery();
  } else {
    await deleteTrackedMenuMessage(ctx);
    const sent = await ctx.replyWithHTML(text, kb.rechargeAmountsKb());
    trackMenuMessage(ctx, sent);
  }
}

async function createAndSendPix(ctx, amount) {
  try {
    const rechargeId = db.createRecharge(ctx.from.id, amount, "PIX");

    const payment = await mp.createPixPayment({
      amount,
      description: `Recarga de saldo - ${config.botName}`,
      externalReference: rechargeId,
    });

    db.setRechargeMpPaymentId(rechargeId, payment.id);

    const caption =
      `💎 <b>Recarga #${rechargeId}</b>\n\n` +
      `💰 Valor: R$ ${amount.toFixed(2)}\n\n` +
      `📱 Escaneie o QR Code ou copie o código Pix abaixo para pagar.\n` +
      `Assim que o pagamento for confirmado, seu saldo é creditado automaticamente!\n\n` +
      `<code>${payment.qrCode || "Código indisponível"}</code>`;

    if (payment.qrCodeBase64) {
      await ctx.replyWithPhoto(
        { source: Buffer.from(payment.qrCodeBase64, "base64") },
        {
          caption,
          parse_mode: "HTML",
          ...kb.pixPaymentKb(payment.ticketUrl, payment.id, payment.qrCode),
        }
      );
    } else {
      await ctx.replyWithHTML(
        caption,
        kb.pixPaymentKb(payment.ticketUrl, payment.id, payment.qrCode)
      );
    }
  } catch (err) {
    console.error("Erro ao criar pagamento Pix:", err?.message || err);
    if (err?.code === "VALIDATION_ERROR") {
      await ctx.reply(`⚠️ ${err.message}`);
      return;
    }
    await ctx.reply(
      "⚠️ Não foi possível gerar o pagamento Pix agora. Verifique se o " +
        "as credenciais de pagamento estão configuradas corretamente ou tente novamente mais tarde."
    );
  }
}

function startSmsPoller(bot) {
  setInterval(async () => {
    const pending = db.listPendingSmsOrders();

    for (const order of pending) {

      if (!order.api_id) {
        console.error(
          `Pedido SMS com id inválido no banco (user ${order.user_id}, produto ${order.product}). `
        );
        continue;
      }

      try {
        const remote = await api.checkOrder(order.api_id);
        const smsList = remote.sms || [];
        const newCount = smsList.length;

        if (newCount > order.sms_count) {
          const lastCode = smsList[smsList.length - 1].code;
          db.updateSmsOrder(order.api_id, {
            status: remote.status,
            sms_count: newCount,
            last_code: lastCode,
          });
          try {
            await bot.telegram.sendMessage(
              order.user_id,
              texts.smsOrderText({
                phone: order.phone,
                label: productLabel(order.product),
                countryLabel: api.countryLabel(order.country),
                priceBrl: order.price_brl,
                status: remote.status,
                lastCode,
              }),
              {
                parse_mode: "HTML",
                ...(lastCode
                  ? kb.smsCodeKb(order.api_id, lastCode, order.phone)
                  : kb.smsOrderKb(order.api_id, false, order.phone)),
              }
            );
          } catch (e) {

          }
          continue;
        }

        if (["TIMEOUT", "BANNED"].includes(remote.status) && !smsList.length) {
          db.refundSmsOrder(order.api_id);
          db.updateSmsOrder(order.api_id, { status: remote.status, done: 1 });
          try {
            await bot.telegram.sendMessage(
              order.user_id,
              `⌛ O número de ${productLabel(
                order.product
              )} (${api.countryLabel(order.country)}) não recebeu SMS a tempo. ` +
                `Seu saldo de R$ ${order.price_brl.toFixed(2)} foi devolvido.`
            );
          } catch (e) {

          }
        } else if (["FINISHED", "CANCELED"].includes(remote.status)) {
          db.updateSmsOrder(order.api_id, { status: remote.status, done: 1 });
        }
      } catch (err) {
        const msg = (err.message || "").slice(0, 300);
        console.error(`Erro ao verificar pedido SMS #${order.api_id}:`, msg);
      }
    }
  }, config.smsPollIntervalMs);
}

module.exports = { register, isAdmin, showServices: showSmsProducts, showSmsProducts, resetWelcomeImage };