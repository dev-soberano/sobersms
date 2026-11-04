/**
 * ╔═╗ ╔═╗ ╔╗  ╔══ ╔═╗ ╔═╗ ╔╦╗ ╔═╗
 * ╚═╗ ║ ║ ╠╩╗ ╠═  ╠╦╝ ╚═╗ ║║║ ╚═╗
 * ╚═╝ ╚═╝ ╚═╝ ╚══ ╩╚═ ╚═╝ ╩ ╩ ╚═╝
 * @author Dev Soberano
 * @link https://github.com/dev-soberano
 * @project SoberSMS
 */
const fs = require("fs");
const path = require("path");
const config = require("./config");



const DATA_PATH = path.resolve(config.dbPath);

let data = {
  users: {},          // user_id -> user
  products: [],        // lista de produtos
  nextProductId: 1,
  orders: [],            // lista de pedidos
  nextOrderId: 1,
  recharges: [],           // lista de recargas
  nextRechargeId: 1,
  coupons: {},               // code -> coupon
  tickets: [],                 // lista de tickets
  nextTicketId: 1,
  smsOrders: [],               
};

function load() {
  if (fs.existsSync(DATA_PATH)) {
    try {
      const raw = fs.readFileSync(DATA_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      data = { ...data, ...parsed };
    } catch (e) {
      console.error("⚠️ Erro ao ler o banco de dados, iniciando vazio:", e.message);
    }
  }
}

function save() {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf-8");
}

function init() {
  load();
  save();
}


function getUser(userId) {
  return data.users[userId] || null;
}

function createUser(userId, username, referredBy) {
  if (getUser(userId)) return;
  data.users[userId] = {
    user_id: userId,
    username: username || "",
    balance: 0,
    referred_by: referredBy || null,
    referral_count: 0,
    referral_earnings: 0,
    banned: 0,
    created_at: Date.now(),
  };

  if (referredBy && referredBy !== userId && data.users[referredBy]) {
    data.users[referredBy].referral_count += 1;
  }
  save();
}

function updateBalance(userId, delta) {
  const user = getUser(userId);
  if (!user) return;
  user.balance += delta;
  save();
}

function setBanned(userId, banned) {
  const user = getUser(userId);
  if (!user) return;
  user.banned = banned ? 1 : 0;
  save();
}

function listAllUserIds() {
  return Object.values(data.users)
    .filter((u) => !u.banned)
    .map((u) => u.user_id);
}

function countUsers() {
  return Object.keys(data.users).length;
}

function addReferralEarning(userId, amount) {
  const user = getUser(userId);
  if (!user) return;
  user.balance += amount;
  user.referral_earnings += amount;
  save();
}

// ---------------- PRODUTOS ----------------

function listCategories() {
  const cats = data.products.filter((p) => p.active).map((p) => p.category);
  return [...new Set(cats)];
}

function listProducts(category) {
  return data.products
    .filter((p) => p.active && (!category || p.category === category))
    .sort((a, b) => a.product_id - b.product_id);
}

function getProduct(productId) {
  return data.products.find((p) => p.product_id === productId) || null;
}

function addProduct({ name, description, price, stock, category }) {
  const product = {
    product_id: data.nextProductId++,
    category: category || "Geral",
    name,
    description,
    price,
    stock,
    active: 1,
  };
  data.products.push(product);
  save();
  return product.product_id;
}

function removeProduct(productId) {
  const product = getProduct(productId);
  if (product) product.active = 0;
  save();
}

function restockProduct(productId, qty) {
  const product = getProduct(productId);
  if (product) product.stock += qty;
  save();
}

function getCoupon(code) {
  const coupon = data.coupons[(code || "").toUpperCase()];
  return coupon && coupon.active ? coupon : null;
}

function createCoupon({ code, type, value, maxUses }) {
  const upper = code.toUpperCase();
  data.coupons[upper] = {
    code: upper,
    type,
    value,
    max_uses: maxUses || 0,
    used_count: 0,
    active: 1,
    created_at: Date.now(),
  };
  save();
}

function removeCoupon(code) {
  const coupon = data.coupons[(code || "").toUpperCase()];
  if (coupon) coupon.active = 0;
  save();
}

function listCoupons() {
  return Object.values(data.coupons)
    .filter((c) => c.active)
    .sort((a, b) => b.created_at - a.created_at);
}

function useCoupon(code) {
  const coupon = data.coupons[(code || "").toUpperCase()];
  if (coupon) coupon.used_count += 1;
  save();
}

function applyCouponToPrice(coupon, price) {
  if (!coupon) return { finalPrice: price, discount: 0 };
  let discount = 0;
  if (coupon.type === "percent") {
    discount = price * (coupon.value / 100);
  } else {
    discount = coupon.value;
  }
  discount = Math.min(discount, price);
  return { finalPrice: Math.max(0, price - discount), discount };
}



function purchaseProduct(userId, productId, couponCode) {
  const user = getUser(userId);
  const product = getProduct(productId);

  if (!product || !product.active) {
    return { ok: false, message: "Produto não encontrado." };
  }
  if (product.stock <= 0) {
    return { ok: false, message: "Produto esgotado no momento." };
  }

  let coupon = null;
  if (couponCode) {
    coupon = getCoupon(couponCode);
    if (!coupon) {
      return { ok: false, message: "Cupom inválido ou expirado." };
    }
    if (coupon.max_uses > 0 && coupon.used_count >= coupon.max_uses) {
      return { ok: false, message: "Este cupom já atingiu o limite de usos." };
    }
  }

  const { finalPrice, discount } = applyCouponToPrice(coupon, product.price);

  if (user.balance < finalPrice) {
    return { ok: false, message: "Saldo insuficiente. Faça uma recarga." };
  }

  user.balance -= finalPrice;
  product.stock -= 1;

  const order = {
    order_id: data.nextOrderId++,
    user_id: userId,
    product_id: productId,
    product_name: product.name,
    price: finalPrice,
    discount,
    coupon_code: coupon ? coupon.code : null,
    created_at: Date.now(),
  };
  data.orders.push(order);

  if (coupon) useCoupon(coupon.code);

  if (user.referred_by) {
    const comissao = finalPrice * (config.comissaoAfiliado / 100);
    addReferralEarning(user.referred_by, comissao);
  }

  save();

  return {
    ok: true,
    message: `Compra de "${product.name}" realizada com sucesso!`,
    finalPrice,
    discount,
    lowStock: product.stock <= config.estoqueMinimo,
    remainingStock: product.stock,
    productName: product.name,
  };
}

function listUserOrders(userId, limit = 10) {
  return data.orders
    .filter((o) => o.user_id === userId)
    .sort((a, b) => b.created_at - a.created_at)
    .slice(0, limit);
}

function listRecentOrders(limit = 15) {
  return [...data.orders]
    .sort((a, b) => b.created_at - a.created_at)
    .slice(0, limit);
}


function createRecharge(userId, amount, method) {
  const recharge = {
    recharge_id: data.nextRechargeId++,
    user_id: userId,
    amount,
    method,
    status: "pendente",
    mp_payment_id: null,
    created_at: Date.now(),
  };
  data.recharges.push(recharge);
  save();
  return recharge.recharge_id;
}

function setRechargeMpPaymentId(rechargeId, mpPaymentId) {
  const recharge = getRecharge(rechargeId);
  if (recharge) recharge.mp_payment_id = String(mpPaymentId);
  save();
}

function getRecharge(rechargeId) {
  return data.recharges.find((r) => r.recharge_id === rechargeId) || null;
}

function getRechargeByMpPaymentId(mpPaymentId) {
  return (
    data.recharges.find((r) => r.mp_payment_id === String(mpPaymentId)) ||
    null
  );
}

function listPendingRecharges() {
  return data.recharges
    .filter((r) => r.status === "pendente")
    .sort((a, b) => a.recharge_id - b.recharge_id);
}

function approveRecharge(rechargeId) {
  const recharge = getRecharge(rechargeId);
  if (!recharge || recharge.status !== "pendente") return null;
  recharge.status = "aprovada";
  updateBalance(recharge.user_id, recharge.amount);
  save();
  return recharge;
}

function rejectRecharge(rechargeId) {
  const recharge = getRecharge(rechargeId);
  if (recharge) recharge.status = "rejeitada";
  save();
}


function createTicket(userId, message) {
  const ticket = {
    ticket_id: data.nextTicketId++,
    user_id: userId,
    message,
    status: "aberto",
    created_at: Date.now(),
  };
  data.tickets.push(ticket);
  save();
  return ticket.ticket_id;
}

function getTicket(ticketId) {
  return data.tickets.find((t) => t.ticket_id === ticketId) || null;
}

function closeTicket(ticketId) {
  const ticket = getTicket(ticketId);
  if (ticket) ticket.status = "fechado";
  save();
}



function createSmsOrder({
  userId,
  apiId,
  product,
  country,
  phone,
  priceBrl,
  maxPriceRub,
}) {
  const order = {
    api_id: apiId,
    user_id: userId,
    product,
    country,
    phone,
    price_brl: priceBrl,
    max_price_rub: maxPriceRub,
    status: "PENDING",
    sms_count: 0,
    last_code: null,
    refunded: 0,
    done: 0,
    created_at: Date.now(),
  };
  data.smsOrders.push(order);
  save();
  return order;
}

function getSmsOrder(apiId) {
  return data.smsOrders.find((o) => o.api_id === apiId) || null;
}

function updateSmsOrder(apiId, patch) {
  const order = getSmsOrder(apiId);
  if (!order) return null;
  Object.assign(order, patch);
  save();
  return order;
}

function listUserSmsOrders(userId, limit = 10) {
  return data.smsOrders
    .filter((o) => o.user_id === userId)
    .sort((a, b) => b.created_at - a.created_at)
    .slice(0, limit);
}


function listPendingSmsOrders() {
  return data.smsOrders.filter((o) => !o.done);
}

function repairBrokenSmsOrders() {
  const broken = data.smsOrders.filter((o) => !o.api_id && !o.done);
  const fixed = [];

  for (const order of broken) {
    if (!order.refunded) {
      updateBalance(order.user_id, order.price_brl);
      order.refunded = 1;
    }
    order.done = 1;
    order.status = "ERRO_INTERNO";
    fixed.push({
      userId: order.user_id,
      product: order.product,
      priceBrl: order.price_brl,
    });
  }

  save();
  return fixed;
}


function refundSmsOrder(apiId) {
  const order = getSmsOrder(apiId);
  if (!order || order.refunded) return null;
  updateBalance(order.user_id, order.price_brl);
  order.refunded = 1;
  save();
  return order;
}



function getStats() {
  const totalUsers = countUsers();
  const totalOrders = data.orders.length;
  const totalRevenue = data.orders.reduce((sum, o) => sum + o.price, 0);
  const pendingRecharges = data.recharges.filter(
    (r) => r.status === "pendente"
  ).length;
  const totalProducts = data.products.filter((p) => p.active).length;
  return {
    totalUsers,
    totalOrders,
    totalRevenue,
    pendingRecharges,
    totalProducts,
  };
}

module.exports = {
  init,
  getUser,
  createUser,
  updateBalance,
  setBanned,
  listAllUserIds,
  countUsers,
  addReferralEarning,
  listCategories,
  listProducts,
  getProduct,
  addProduct,
  removeProduct,
  restockProduct,
  getCoupon,
  createCoupon,
  removeCoupon,
  listCoupons,
  purchaseProduct,
  listUserOrders,
  listRecentOrders,
  createRecharge,
  setRechargeMpPaymentId,
  getRecharge,
  getRechargeByMpPaymentId,
  listPendingRecharges,
  approveRecharge,
  rejectRecharge,
  createTicket,
  getTicket,
  closeTicket,
  createSmsOrder,
  getSmsOrder,
  updateSmsOrder,
  listUserSmsOrders,
  listPendingSmsOrders,
  repairBrokenSmsOrders,
  refundSmsOrder,
  getStats,
};