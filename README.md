<div align="center">

# 🤖 SoberSMS

**Bot de Telegram para vender números virtuais e receber SMS**

Compre números para WhatsApp, Telegram, Instagram e mais de 20 serviços,
receba o código por SMS direto no bot e receba dos seus clientes por Pix.

*by Dev Soberano*

</div>

---

## ✨ O que ele faz

- 📱 **Números virtuais** para mais de 20 serviços (WhatsApp, Telegram, Instagram, Facebook, TikTok, Google…)
- 🌍 **109 países** com bandeira e nome
- 🔔 **Aviso automático** quando o SMS chega (a mensagem se atualiza sozinha)
- 📋 **Botões de copiar** — número e código vão direto para a área de transferência
- 💰 **Recarga por Pix** com confirmação automática (MisticPay ou Mercado Pago)
- 💵 **Preços simples**: Brasil com valor fixo e o resto do mundo por multiplicador
- 🤝 **Programa de afiliados** com comissão configurável
- 🎟️ Cupons de desconto, histórico de pedidos, suporte por ticket
- ⚙️ **Tudo configurável pelo Telegram** — nada de mexer em código

## 📸 Como é o fluxo

```
Escolha o serviço  →  escolha o país  →  Receber SMS

🌐 País: Brasil 🇧🇷
⚙️ Serviço: WhatsApp
📱 Número (toque para copiar):
5573988527633

➡️ Insira o número no aplicativo, solicite o código e aguarde aqui.

📶 Status: Aguardando SMS…
🕐 Expira às: 23:39
```

Quando o SMS chega, o bot atualiza a mensagem e mostra o código com botão de copiar.
Se o SMS não chegar em 15 minutos, o valor volta para o saldo automaticamente.

---

## 🚀 Instalação (5 minutos)

### 1. Crie o seu bot no Telegram
1. Abra o **[@BotFather](https://t.me/BotFather)** e mande `/newbot`
2. Escolha o nome e o usuário do bot
3. Ele vai devolver um **token** — copie

### 2. Configure o arquivo
```bash
git clone https://SEU_USER/sobersms.git
cd sobersms
npm install
cp .env.example .env
```

Abra o `.env` e cole o token:
```env
BOT_TOKEN=cole_seu_token_aqui
```

> É a **única** coisa que precisa editar. Todo o resto você configura pelo Telegram.

### 3. Suba o bot
```bash
npm start
```

Deve aparecer:
```
🌐 Servidor HTTP rodando na porta 25594
🤖 SoberSMS (@seu_bot) conectado — aguardando mensagens...
```

### 4. Assuma como dono
Abra o seu bot no Telegram e mande `/start`. **O primeiro usuário vira o dono.**

### 5. Configure pelo Telegram
Menu → **⚙️ Configurações**:

| Opção | O que faz |
|---|---|
| 🤖 Nome do bot | Muda na hora, sem reiniciar |
| 🖼️ Imagem do /start | Envie como **arquivo** para manter a qualidade |
| 🔑 API de números | Cole sua chave `gsk_live_...` (o bot testa a conexão) |
| 💰 Pagamento | MisticPay ou Mercado Pago |
| 💵 Preços e limites | Preço do Brasil, multiplicador, recarga mínima |
| 📚 Tutorial | Passo a passo completo dentro do bot |

---

## 🔑 De onde vêm os números

Os números vêm da **API da Gótica SMS** ([gotica-sms.com](https://gotica-sms.com)) —
você precisa de uma conta lá para gerar sua chave (`gsk_live_...`).

1. Crie sua conta em **gotica-sms.com** e faça login no painel
2. Clique em **🔌 API** no topo
3. Em **Minha chave**, clique em **Gerar nova chave**
4. Copie (ela aparece uma única vez) e cole no painel do bot

O saldo para comprar os números fica **na sua conta da API** — você recarrega
lá e cada ativação desconta desse saldo.

## 💰 Como você lucra

O bot vende mais caro do que compra — a diferença é o seu lucro, e você
configura pelo Telegram:

| Regra | Padrão | Exemplo (WhatsApp) |
|---|---|---|
| 🇧🇷 Brasil | preço fixo | cliente paga **R$ 13,00** |
| 🌍 Fora do Brasil | multiplicador | cliente paga **2×** o custo |

Cada número recebido pelo seu cliente é lucro no seu bolso.

## 💳 Recarga dos clientes

Seus clientes recarregam saldo por **Pix** dentro do bot. Você escolhe a
operadora no painel:

- **[MisticPay](https://misticpay.com)** — `CLIENT_ID` e `CLIENT_SECRET`
- **Mercado Pago** — `Access Token` (começa com `APP_USR-`)

O crédito entra automaticamente quando o Pix é pago.

---

## 📦 Comandos

| Comando | O que faz |
|---|---|
| `/start` | Abre o menu |
| `/servicos` | Comprar número |
| `/paises` | Ver preços por país |
| `/recarga` | Adicionar saldo via Pix |
| `/saldo` | Ver seu saldo |
| `/numeros` | Últimos números comprados |
| `/historico` | Histórico de compras |
| `/afiliados` | Seu link de indicação |
| `/cupom` | Aplicar cupom |
| `/ajuda` | Como usar |
| `/suporte` | Falar com o suporte |
| `/config` | ⚙️ Configurações (só o dono) |

## 🛠️ Requisitos

- **Node.js 18+** (recomendado: 22 LTS)
- Uma conta na API da Gótica SMS com saldo
- Uma conta MisticPay ou Mercado Pago (para receber as recargas)

## ❓ Dúvidas

**Preciso saber programar?**
Não. Depois de colar o token no `.env`, tudo é configurado pelo Telegram.

**Posso rodar em qual sistema?**
Windows, Linux ou Mac. Para ficar 24h no ar, use um servidor VPS com PM2:
```bash
npm install -g pm2
pm2 start src/server.js --name sobersms
pm2 save
```

**O SMS não chega?**
Se o SMS não chegar em 15 minutos, a ativação expira sozinha e o valor volta
para o saldo do cliente automaticamente. Nunca fica prejuízo.

**Como falar com suporte?**
Dentro do bot, use `/suporte` — a mensagem vai para o dono do bot.

---

<div align="center">

Feito com 💜 por **Dev Soberano**

</div>
