// ============================================================================
// SoberSMS — configurações do DONO (settings.json)
// ----------------------------------------------------------------------------
// Este arquivo é gravado pelo próprio Telegram (painel ⚙️ Configurações), então
// quem usa o bot não precisa mexer em código nem no .env. O que estiver aqui
// vale mais do que as variáveis de ambiente.
// ============================================================================

const fs = require("fs");
const path = require("path");

const ARQUIVO = path.resolve(__dirname, "..", "settings.json");

let dados = {};

function carregar() {
  try {
    dados = JSON.parse(fs.readFileSync(ARQUIVO, "utf8"));
  } catch (_) {
    dados = {};
  }
}

function salvar() {
  try {
    fs.writeFileSync(ARQUIVO, JSON.stringify(dados, null, 2), "utf8");
    return true;
  } catch (e) {
    console.error("[settings] erro ao salvar:", e.message);
    return false;
  }
}

/** Valor salvo pelo dono, ou undefined se nunca configurou. */
function get(chave) {
  const v = dados[chave];
  return v === "" ? undefined : v;
}

function set(chave, valor) {
  dados[chave] = valor;
  return salvar();
}

function setVarios(obj) {
  Object.assign(dados, obj);
  return salvar();
}

function todos() {
  return { ...dados };
}

carregar();

module.exports = { get, set, setVarios, todos, salvar, ARQUIVO };
