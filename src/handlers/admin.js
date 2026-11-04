const db = require("../db");
const kb = require("../keyboards");
const config = require("../config");
const state = require("../state");
const api = require("../gotica");

function isAdmin(userId) {
  return config.adminIds.includes(userId);
}


async function safeAnswerCbQuery(ctx, text, extra) {
  try {
    await ctx.answerCbQuery(text, extra);
  } catch (e) {
  
  }
}

function requireAdmin(ctx) {
  if (!isAdmin(ctx.from.id)) {
    if (ctx.updateType === "callback_query") {
      safeAnswerCbQuery(ctx, "Acesso restrito.", { show_alert: true });
    } else {
      ctx.reply("Acesso restrito.");
    }
    return false;
  }
  return true;
}

async function safeEditMessageText(ctx, text, extra) {
  const isPhoto = !!(ctx.callbackQuery && ctx.callbackQuery.message && ctx.callbackQuery.message.photo);
  if (isPhoto) {
    await ctx.deleteMessage().catch(() => {});
    await ctx.replyWithHTML(text, extra);
    return;
  }
  try {
    await ctx.editMessageText(text, extra);
  } catch (err) {
    if (!err.description || !err.description.includes("no text in the message")) {
      throw err;
    }
    await ctx.deleteMessage().catch(() => {});
    await ctx.replyWithHTML(text, extra);
  }
}

function register(bot) {
  bot.command("admin", async (ctx) => {
    if (!requireAdmin(ctx)) return;
    await ctx.replyWithHTML(
      "⚙️ <b>Painel Administrativo</b>\n\nEscolha uma ação:",
      kb.adminPanelKb()
    );
  });

  bot.action("admin:panel", async (ctx) => {
    if (!requireAdmin(ctx)) return;
    await safeEditMessageText(ctx, "⚙️ <b>Painel Administrativo</b>\n\nEscolha uma ação:", {
      parse_mode: "HTML",
      ...kb.adminPanelKb(),
    });
    await safeAnswerCbQuery(ctx);
  });

  bot.action("admin:stats", async (ctx) => {
    if (!requireAdmin(ctx)) return;
    const s = db.getStats();
    const text =
      `📊 <b>Estatísticas</b>\n\n` +
      `👥 Usuários: ${s.totalUsers}\n` +
      `🛒 Pedidos realizados: ${s.totalOrders}\n` +
      `💰 Receita total: R$ ${s.totalRevenue.toFixed(2)}\n` +
      `📱 Serviços SMS configurados: ${config.smsProducts.length}\n` +
      `⏳ Recargas pendentes: ${s.pendingRecharges}`;
    await safeEditMessageText(ctx, text, { parse_mode: "HTML", ...kb.backButton("admin:panel") });
    await safeAnswerCbQuery(ctx);
  });

  bot.command("stats", async (ctx) => {
    if (!requireAdmin(ctx)) return;
    const s = db.getStats();
    await ctx.replyWithHTML(
      `📊 Usuários: ${s.totalUsers} | Pedidos: ${s.totalOrders} | ` +
        `Receita: R$ ${s.totalRevenue.toFixed(2)} | Serviços SMS: ${config.smsProducts.length} | ` +
        `Recargas pendentes: ${s.pendingRecharges}`
    );
  });

  bot.action("admin:api_balance", async (ctx) => {
    if (!requireAdmin(ctx)) return;
    await safeAnswerCbQuery(ctx, "⏳ Consultando...");
    try {
      const profile = await api.getProfile();
      const text =
        `💰 <b>Saldo na API</b>\n\n` +
        `Saldo em Rubes: ${profile.balance} RUB\n` +
        `Saldo em Reais: R$ ${api.rubToBrl(profile.balance).toFixed(2)}\n\n`;
      await safeEditMessageText(ctx, text, { parse_mode: "HTML", ...kb.backButton("admin:panel") });
    } catch (err) {
      console.error("Erro ao consultar saldo API:", err.message);
      await safeEditMessageText(
        ctx,
        "⚠️ Erro ao consultar a API..",
        kb.backButton("admin:panel")
      );
    }
  });

  bot.command("saldosim", async (ctx) => {
    if (!requireAdmin(ctx)) return;
    try {
      const profile = await api.getProfile();
      await ctx.reply(
        `💰 Saldo na API\n\n` +
          `Saldo em Rubes: ${profile.balance} RUB\n` +
          `Saldo em Reais: R$ ${api.rubToBrl(profile.balance).toFixed(2)}\n`
      );
    } catch (err) {
      console.error("Erro ao consultar saldo API:", err.message);
      await ctx.reply(
        "⚠️ Erro ao consultar a API."
      );
    }
  });


  bot.command("consertarpendentes", async (ctx) => {
    if (!requireAdmin(ctx)) return;
    const fixed = db.repairBrokenSmsOrders();

    if (!fixed.length) {
      await ctx.reply("✅ Nenhum pedido de SMS travado encontrado.");
      return;
    }

    const listing = fixed
      .map((f) => `👤 ${f.userId} — ${f.product} — R$ ${f.priceBrl.toFixed(2)}`)
      .join("\n");
    await ctx.replyWithHTML(
      `🔧 <b>${fixed.length} pedido(s) consertado(s)</b>\n\n${listing}\n\n` +
        `O saldo foi devolvido a cada usuário e eles foram avisados.`
    );

    for (const f of fixed) {
      try {
        await ctx.telegram.sendMessage(
          f.userId,
          `⚠️ Identificamos uma falha técnica em uma compra de número anterior. ` +
            `Devolvemos R$ ${f.priceBrl.toFixed(2)} ao seu saldo. Pedimos desculpas pelo transtorno!`
        );
      } catch (e) {
    
      }
    }
  });

  bot.action("admin:add_coupon", async (ctx) => {
    if (!requireAdmin(ctx)) return;
    state.setState(ctx.from.id, "coupon_code", {});
    await safeEditMessageText(
      ctx,
      "🎟️ <b>Novo cupom</b>\n\nDigite o <b>código</b> (ex: PROMO10):",
      { parse_mode: "HTML", ...kb.backButton("admin:panel") }
    );
    await safeAnswerCbQuery(ctx);
  });

  bot.action("admin:list_coupons", async (ctx) => {
    if (!requireAdmin(ctx)) return;
    const coupons = db.listCoupons();
    if (!coupons.length) {
      await safeEditMessageText(ctx, "📋 Nenhum cupom ativo no momento.", kb.backButton("admin:panel"));
      await safeAnswerCbQuery(ctx);
      return;
    }
    const listing = coupons
      .map((c) => {
        const val = c.type === "percent" ? `${c.value}%` : `R$ ${c.value.toFixed(2)}`;
        const usage = c.max_uses > 0 ? `${c.used_count}/${c.max_uses}` : `${c.used_count}/∞`;
        return `🎟️ <b>${c.code}</b> — ${val} de desconto (usos: ${usage})`;
      })
      .join("\n");
    await safeEditMessageText(ctx, `📋 <b>Cupons ativos</b>\n\n${listing}`, {
      parse_mode: "HTML",
      ...kb.backButton("admin:panel"),
    });
    await safeAnswerCbQuery(ctx);
  });

  bot.action("admin:recharges", async (ctx) => {
    if (!requireAdmin(ctx)) return;
    const pending = db.listPendingRecharges();
    if (!pending.length) {
      await safeEditMessageText(ctx, "✅ Nenhuma recarga pendente.", kb.backButton("admin:panel"));
      await safeAnswerCbQuery(ctx);
      return;
    }
    await safeEditMessageText(
      ctx,
      `💰 <b>${pending.length} recarga(s) pendente(s)</b>\n\nDetalhes enviados abaixo:`,
      { parse_mode: "HTML", ...kb.backButton("admin:panel") }
    );
    for (const r of pending) {
      await ctx.replyWithHTML(
        `🆔 #${r.recharge_id} — Usuário ${r.user_id}\n💵 R$ ${r.amount.toFixed(2)} via ${r.method}`,
        kb.rechargeApprovalKb(r.recharge_id)
      );
    }
    await safeAnswerCbQuery(ctx);
  });

  bot.action(/^rch_ok:(\d+)$/, async (ctx) => {
    if (!requireAdmin(ctx)) return;
    const rechargeId = Number(ctx.match[1]);
    const recharge = db.approveRecharge(rechargeId);
    if (recharge) {
      await safeEditMessageText(ctx, `✅ Recarga #${rechargeId} aprovada.`);
      try {
        await ctx.telegram.sendMessage(
          recharge.user_id,
          `💎 Sua recarga de R$ ${recharge.amount.toFixed(2)} foi aprovada! O saldo já está disponível.`
        );
      } catch (e) {}
    } else {
      await safeAnswerCbQuery(ctx, "Essa recarga já foi processada.", { show_alert: true });
    }
    await safeAnswerCbQuery(ctx);
  });

  bot.action(/^rch_no:(\d+)$/, async (ctx) => {
    if (!requireAdmin(ctx)) return;
    const rechargeId = Number(ctx.match[1]);
    const recharge = db.getRecharge(rechargeId);
    db.rejectRecharge(rechargeId);
    await safeEditMessageText(ctx, `❌ Recarga #${rechargeId} rejeitada.`);
    if (recharge) {
      try {
        await ctx.telegram.sendMessage(
          recharge.user_id,
          `❌ Sua solicitação de recarga #${rechargeId} foi rejeitada. Fale com o suporte se acha que é um engano.`
        );
      } catch (e) {}
    }
    await safeAnswerCbQuery(ctx);
  });


  bot.action("admin:orders", async (ctx) => {
    if (!requireAdmin(ctx)) return;
    const orders = db.listRecentOrders();
    if (!orders.length) {
      await safeEditMessageText(ctx, "🛒 Nenhum pedido registrado ainda.", kb.backButton("admin:panel"));
      await safeAnswerCbQuery(ctx);
      return;
    }
    const listing = orders
      .map((o) => {
        const date = new Date(o.created_at).toLocaleString("pt-BR");
        return `#${o.order_id} — ${o.product_name} — R$ ${o.price.toFixed(2)} — user ${o.user_id} — ${date}`;
      })
      .join("\n");
    await safeEditMessageText(ctx, `🛒 <b>Últimos pedidos</b>\n\n${listing}`, {
      parse_mode: "HTML",
      ...kb.backButton("admin:panel"),
    });
    await safeAnswerCbQuery(ctx);
  });

  bot.action("admin:adjust_balance", async (ctx) => {
    if (!requireAdmin(ctx)) return;
    state.setState(ctx.from.id, "adjust_balance_user_id", {});
    await safeEditMessageText(
      ctx,
      "👤 <b>Ajustar saldo</b>\n\nDigite o ID do usuário:",
      { parse_mode: "HTML", ...kb.backButton("admin:panel") }
    );
    await safeAnswerCbQuery(ctx);
  });

  bot.command("addsaldo", async (ctx) => {
    if (!requireAdmin(ctx)) return;
    const parts = ctx.message.text.split(" ");
    if (parts.length < 3) {
      await ctx.reply("Uso: /addsaldo <user_id> <valor>");
      return;
    }
    const userId = Number(parts[1]);
    const amount = Number(parts[2].replace(",", "."));
    if (!userId || !amount) {
      await ctx.reply("⚠️ Parâmetros inválidos.");
      return;
    }
    db.updateBalance(userId, amount);
    await ctx.reply(`✅ Saldo de ${userId} ajustado em R$ ${amount.toFixed(2)}.`);
    try {
      await ctx.telegram.sendMessage(
        userId,
        `💰 Seu saldo foi ajustado em R$ ${amount.toFixed(2)} pela administração.`
      );
    } catch (e) {}
  });


  bot.action("admin:ban_user", async (ctx) => {
    if (!requireAdmin(ctx)) return;
    state.setState(ctx.from.id, "ban_user_id", {});
    await safeEditMessageText(
      ctx,
      "🚫 <b>Banir/Desbanir usuário</b>\n\nDigite o ID do usuário:",
      { parse_mode: "HTML", ...kb.backButton("admin:panel") }
    );
    await safeAnswerCbQuery(ctx);
  });

  bot.action(/^ban:(\d+)$/, async (ctx) => {
    if (!requireAdmin(ctx)) return;
    const userId = Number(ctx.match[1]);
    db.setBanned(userId, true);
    await safeEditMessageText(ctx, `🚫 Usuário ${userId} banido.`, kb.backButton("admin:panel"));
    await safeAnswerCbQuery(ctx);
  });

  bot.action(/^unban:(\d+)$/, async (ctx) => {
    if (!requireAdmin(ctx)) return;
    const userId = Number(ctx.match[1]);
    db.setBanned(userId, false);
    await safeEditMessageText(ctx, `✅ Usuário ${userId} desbanido.`, kb.backButton("admin:panel"));
    await safeAnswerCbQuery(ctx);
  });


  bot.action("admin:broadcast", async (ctx) => {
    if (!requireAdmin(ctx)) return;
    state.setState(ctx.from.id, "broadcast_message", {});
    await safeEditMessageText(
      ctx,
      "📢 <b>Broadcast</b>\n\nDigite a mensagem que será enviada a todos os usuários:",
      { parse_mode: "HTML", ...kb.backButton("admin:panel") }
    );
    await safeAnswerCbQuery(ctx);
  });

  bot.command("responder", async (ctx) => {
    if (!requireAdmin(ctx)) return;
    const parts = ctx.message.text.split(" ");
    if (parts.length < 3) {
      await ctx.reply("Uso: /responder <ticket_id> <mensagem>");
      return;
    }
    const ticketId = Number(parts[1]);
    const message = parts.slice(2).join(" ");
    const ticket = db.getTicket(ticketId);
    if (!ticket) {
      await ctx.reply("⚠️ Ticket não encontrado.");
      return;
    }
    db.closeTicket(ticketId);
    try {
      await ctx.telegram.sendMessage(
        ticket.user_id,
        `🆘 <b>Resposta do suporte (ticket #${ticketId})</b>\n\n${message}`,
        { parse_mode: "HTML" }
      );
      await ctx.reply(`✅ Resposta enviada ao usuário ${ticket.user_id}.`);
    } catch (e) {
      await ctx.reply("⚠️ Não foi possível enviar a mensagem ao usuário.");
    }
  });


  bot.on("text", async (ctx, next) => {
    if (!isAdmin(ctx.from.id)) return next();
    const s = state.getState(ctx.from.id);
    if (!s) return next();

    switch (s.step) {
      case "coupon_code":
        state.setState(ctx.from.id, "coupon_type", {
          code: ctx.message.text.trim().toUpperCase(),
        });
        await ctx.reply(
          "Tipo de desconto — digite <b>percent</b> (percentual) ou <b>fixed</b> (valor fixo):",
          { parse_mode: "HTML" }
        );
        return;

      case "coupon_type": {
        const type = ctx.message.text.trim().toLowerCase();
        if (!["percent", "fixed"].includes(type)) {
          await ctx.reply("⚠️ Digite 'percent' ou 'fixed'.");
          return;
        }
        state.setState(ctx.from.id, "coupon_value", { ...s.data, type });
        await ctx.reply(
          type === "percent"
            ? "Digite o percentual de desconto (ex: 10):"
            : "Digite o valor fixo de desconto em R$ (ex: 5.00):"
        );
        return;
      }

      case "coupon_value": {
        const value = Number(ctx.message.text.replace(",", "."));
        if (!value || value <= 0) {
          await ctx.reply("⚠️ Valor inválido.");
          return;
        }
        state.setState(ctx.from.id, "coupon_max_uses", { ...s.data, value });
        await ctx.reply("Limite de usos (0 = ilimitado):");
        return;
      }

      case "coupon_max_uses": {
        if (!/^\d+$/.test(ctx.message.text.trim())) {
          await ctx.reply("⚠️ Digite um número inteiro (0 = ilimitado).");
          return;
        }
        const maxUses = Number(ctx.message.text.trim());
        db.createCoupon({ ...s.data, maxUses });
        state.clearState(ctx.from.id);
        await ctx.replyWithHTML(
          `✅ Cupom <b>${s.data.code}</b> criado com sucesso!`,
          kb.backButton("admin:panel")
        );
        return;
      }

      case "adjust_balance_user_id": {
        if (!/^\d+$/.test(ctx.message.text.trim())) {
          await ctx.reply("⚠️ Digite apenas o número do ID.");
          return;
        }
        state.setState(ctx.from.id, "adjust_balance_amount", {
          userId: Number(ctx.message.text.trim()),
        });
        await ctx.reply("Digite o valor a somar (use negativo para remover, ex: -10.00):");
        return;
      }

      case "adjust_balance_amount": {
        const amount = Number(ctx.message.text.replace(",", "."));
        if (!amount) {
          await ctx.reply("⚠️ Valor inválido.");
          return;
        }
        db.updateBalance(s.data.userId, amount);
        state.clearState(ctx.from.id);
        await ctx.replyWithHTML(
          `✅ Saldo de ${s.data.userId} ajustado em R$ ${amount.toFixed(2)}.`,
          kb.backButton("admin:panel")
        );
        try {
          await ctx.telegram.sendMessage(
            s.data.userId,
            `💰 Seu saldo foi ajustado em R$ ${amount.toFixed(2)} pela administração.`
          );
        } catch (e) {}
        return;
      }

      case "ban_user_id": {
        if (!/^\d+$/.test(ctx.message.text.trim())) {
          await ctx.reply("⚠️ Digite apenas o número do ID.");
          return;
        }
        const userId = Number(ctx.message.text.trim());
        const user = db.getUser(userId);
        state.clearState(ctx.from.id);
        if (!user) {
          await ctx.reply("⚠️ Usuário não encontrado.");
          return;
        }
        await ctx.replyWithHTML(
          `Usuário ${userId} — status atual: ${user.banned ? "🚫 banido" : "✅ ativo"}`,
          kb.banToggleKb(userId, !!user.banned)
        );
        return;
      }

      case "broadcast_message": {
        state.clearState(ctx.from.id);
        const userIds = db.listAllUserIds();
        const status = await ctx.reply(`📤 Enviando para ${userIds.length} usuário(s)...`);
        let sent = 0;
        let failed = 0;
        for (const uid of userIds) {
          try {
            await ctx.telegram.sendMessage(uid, ctx.message.text);
            sent++;
          } catch (e) {
            failed++;
          }
        }
        await ctx.telegram.editMessageText(
          status.chat.id,
          status.message_id,
          undefined,
          `✅ Broadcast concluído!\n\nEnviados: ${sent}\nFalhas: ${failed}`
        );
        return;
      }

      default:
        return next();
    }
  });
}

module.exports = { register, isAdmin }