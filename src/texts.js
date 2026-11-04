const config = require("./config");

function welcome() { return `<tg-emoji emoji-id="4956606007221421405">💜</tg-emoji> <b>Bem-vindo ao ${config.botName}!</b>

<blockquote><tg-emoji emoji-id="4956461073550017373">📱</tg-emoji> Compre números virtuais pra receber SMS, gerencie seu saldo e aproveite o programa de afiliados.</blockquote>

<i>by ${config.ownerTag}</i>`;
}

function about() { return `<tg-emoji emoji-id="5213037321686886777">ℹ️</tg-emoji> <b>${config.botName}</b>

<blockquote>Bot de vendas automatizado, com painel de perfil, saldo, sistema de afiliados,
números virtuais pra SMS, histórico de pedidos, suporte e pagamento
via PIX.</blockquote>

<tg-emoji emoji-id="5239947340495733787">💠</tg-emoji> Desenvolvido por ${config.ownerTag}`;
}

const HOWTO = `<tg-emoji emoji-id="5436113877181941026">❓</tg-emoji> <b>Como usar</b>

<blockquote>1️⃣ Toque em <tg-emoji emoji-id="5231302331538104275">📱</tg-emoji> <b>Serviços</b> e escolha a plataforma (WhatsApp, Facebook etc).
2️⃣ Escolha o país do número.
3️⃣ Confirme a compra — o valor será descontado do seu saldo.
4️⃣ Use o número recebido na plataforma desejada e toque em <b>Verificar SMS</b>.
5️⃣ Assim que o código chegar, o bot te avisa automaticamente.
6️⃣ Se o SMS não chegar em até 15 minutos, o valor volta pro seu saldo sozinho.
7️⃣ Sem saldo? Use <tg-emoji emoji-id="5427168083074628963">💎</tg-emoji> <b>Recarga</b> e pague via Pix — o saldo cai automático.
8️⃣ Convide amigos pelo seu link em <tg-emoji emoji-id="5213403875670765022">🤝</tg-emoji> <b>Afiliados</b> e ganhe comissão em cada compra deles!
9️⃣ Use <tg-emoji emoji-id="5231302331538104275">📱</tg-emoji> <b>/numeros</b> pra ver seus últimos pedidos e <tg-emoji emoji-id="5215668805199473901">🆘</tg-emoji> <b>/suporte</b> se precisar de ajuda.</blockquote>`;

const TERMS = `<tg-emoji emoji-id="5240024366439221984">📄</tg-emoji> <b>Termos de uso</b>

<blockquote>• As compras realizadas não são reembolsáveis, salvo erro comprovado do sistema.
• Se o número não receber SMS dentro do prazo, o valor é devolvido automaticamente.
• É proibido o uso do bot para fins ilegais ou fraudulentos.
• A administração pode suspender contas que violam os termos.
• Pagamentos via Pix são processados pelo Pix; o crédito do saldo ocorre
  automaticamente após a confirmação do pagamento.
• Ao usar este bot, você concorda com estas condições.</blockquote>`;

function profileText(user, username) {
  return `<tg-emoji emoji-id="4958963647914181913">👤</tg-emoji> <b>Seu perfil</b>

<blockquote><tg-emoji emoji-id="5940765585204843231">🆔</tg-emoji> <b>ID:</b> <code>${user.user_id}</code>
👋 <b>Usuário:</b> @${username || "sem username"}
<tg-emoji emoji-id="5215725958329282459">💰</tg-emoji> <b>Saldo:</b> R$ ${user.balance.toFixed(2)}
<tg-emoji emoji-id="5213403875670765022">🤝</tg-emoji> <b>Indicados:</b> ${user.referral_count}
💵 <b>Ganhos com indicações:</b> R$ ${user.referral_earnings.toFixed(2)}</blockquote>`;
}

function affiliatesText(botUsername, user) {
  const link = `https://t.me/${botUsername}?start=${user.user_id}`;
  return `<tg-emoji emoji-id="5213403875670765022">🤝</tg-emoji> <b>Programa de Indicação</b>

<blockquote>💸 Convide seus amigos para o bot e receba <b>${config.comissaoAfiliado}% de comissão</b> sobre cada compra que eles fizerem.

<tg-emoji emoji-id="5231200819986047254">💰</tg-emoji> Exemplo: compra de R$10 → comissão de R$${(
    (10 * config.comissaoAfiliado) /
    100
  ).toFixed(2)} para você.</blockquote>

👤 <b>Indicações:</b> ${user.referral_count}
💵 <b>Ganhos totais:</b> R$ ${user.referral_earnings.toFixed(2)}

<tg-emoji emoji-id="5215441850537618106">🔗</tg-emoji> <b>Seu link de indicação:</b>
<code>${link}</code>`;
}

function productDetailText(product) {
  return `<tg-emoji emoji-id="5461151367559141950">🛒</tg-emoji> <b>${product.name}</b>

<blockquote>${product.description || "Sem descrição."}

<tg-emoji emoji-id="5231200819986047254">💰</tg-emoji> <b>Preço:</b> R$ ${product.price.toFixed(2)}
<tg-emoji emoji-id="5323463074055739425">📦</tg-emoji> <b>Estoque:</b> ${product.stock} unidade(s)</blockquote>`;
}

function orderHistoryText(orders) {
  if (!orders.length) {
    return `<tg-emoji emoji-id="5323463074055739425">📦</tg-emoji> Você ainda não fez nenhuma compra.`;
  }
  const lines = orders.map((o) => {
    const date = new Date(o.created_at).toLocaleString("pt-BR");
    const discountTxt = o.discount > 0 ? ` (desconto R$ ${o.discount.toFixed(2)})` : "";
    return `<blockquote>🛍️ <b>${o.product_name}</b> — R$ ${o.price.toFixed(2)}${discountTxt}\n🕒 ${date}</blockquote>`;
  });
  return `<tg-emoji emoji-id="5323463074055739425">📦</tg-emoji> <b>Histórico de compras</b>\n\n${lines.join("\n\n")}`;
}

function smsProductHeaderText(label) {
  return `<tg-emoji emoji-id="5231302331538104275">📱</tg-emoji> <b>${label}</b>

<blockquote>🌍 Escolha o país do número:</blockquote>`;
}

function smsConfirmText(label, countryLabel, priceBrl) {
  return `🌐 <b>País:</b> ${countryLabel}
⚙️ <b>Serviço:</b> ${label}
💵 <b>Valor:</b> R$ ${priceBrl.toFixed(2)}
📱 <b>Operadora:</b> Qualquer Operadora

<blockquote>ℹ️ A disponibilidade varia em tempo real — clique em <b>"Receber SMS"</b> pra ver na hora se há número disponível.

NOTA: Os preços variam por país, use /paises</blockquote>`;
}

function smsOrderText({ phone, label, countryLabel, priceBrl, status, lastCode, expiresAt }) {
  const expira = expiresAt
    ? new Date(expiresAt).toLocaleTimeString("pt-BR", { hour: "numeric", minute: "2-digit" })
    : "";

  if (lastCode) {
    return `🌐 <b>País:</b> ${countryLabel}
⚙️ <b>Serviço:</b> ${label}
📱 <b>Número:</b> <code>${phone}</code>

🔑 <b>Código recebido:</b>
<code>${lastCode}</code>

<blockquote>✅ Use o código no aplicativo para concluir seu cadastro.</blockquote>`;
  }

  let statusLine = `📶 <b>Status:</b> Aguardando SMS…`;
  if (status === "TIMEOUT") statusLine = `📶 <b>Status:</b> ⌛ Expirado — valor devolvido`;
  else if (status === "CANCELED") statusLine = `📶 <b>Status:</b> ❌ Cancelado — valor devolvido`;
  else if (status === "BANNED") statusLine = `📶 <b>Status:</b> 🚫 Número banido — valor devolvido`;
  else if (status === "FINISHED") statusLine = `📶 <b>Status:</b> ✅ Finalizado`;

  return `🌐 <b>País:</b> ${countryLabel}
⚙️ <b>Serviço:</b> ${label}
📱 <b>Número (toque para copiar):</b>
<code>${phone}</code>

➡️ Insira o número no aplicativo, solicite o código e aguarde aqui. A mensagem será atualizada automaticamente.

${statusLine}${expira ? `\n🕐 <b>Expira às:</b> ${expira}` : ""}`;
}

function smsHistoryText(orders, productLabel, countryLabel) {
  if (!orders.length) {
    return `<tg-emoji emoji-id="4956461073550017373">📱</tg-emoji> Você ainda não comprou nenhum número.`;
  }
  const lines = orders.map((o) => {
    const date = new Date(o.created_at).toLocaleString("pt-BR");
    return `<blockquote><tg-emoji emoji-id="4956461073550017373">📱</tg-emoji> <b>${productLabel(o.product)}</b> (${countryLabel(o.country)}) — R$ ${o.price_brl.toFixed(2)}\n🕒 ${date} — status: ${o.status}</blockquote>`;
  });
  return `<tg-emoji emoji-id="4956461073550017373">📱</tg-emoji> <b>Seus últimos números</b>\n\n${lines.join("\n\n")}`;
}

module.exports = {
  welcome,
  about,
  HOWTO,
  TERMS,
  profileText,
  affiliatesText,
  productDetailText,
  orderHistoryText,
  smsProductHeaderText,
  smsConfirmText,
  smsOrderText,
  smsHistoryText,
};