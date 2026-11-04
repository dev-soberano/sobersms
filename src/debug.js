// Ferramenta de conferência: mostra o preço e o saldo na API.
// Uso: node src/debug.js
require("dotenv").config();
const api = require("./gotica");

(async () => {
  await api.ensureCountryMeta();
  const perfil = await api.getProfile();
  console.log("saldo na API:", perfil.balance);

  const preco = await api.getCheapestForCountry("whatsapp", "br");
  console.log("whatsapp/br → cliente paga R$", preco.priceBrl.toFixed(2), "| custo R$", preco.costRub.toFixed(2));
})();
