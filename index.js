require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");
const fs = require("fs");
const path = require("path");
const locales = require("./locales");

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error("❌ BOT_TOKEN topilmadi. .env faylida BOT_TOKEN ni o'rnating.");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// --- Simple persistent storage for user language preference ---
const DB_PATH = path.join(__dirname, "userlangs.json");
let userLangs = {};
try {
  if (fs.existsSync(DB_PATH)) {
    userLangs = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
  }
} catch (e) {
  console.error("Failed to load userlangs.json", e);
}
function saveLangs() {
  fs.writeFileSync(DB_PATH, JSON.stringify(userLangs, null, 2));
}
function getLang(userId) {
  return userLangs[userId] || "en";
}
function setLang(userId, lang) {
  userLangs[userId] = lang;
  saveLangs();
}
function t(userId, key, vars = {}) {
  const lang = getLang(userId);
  let str = (locales[lang] && locales[lang][key]) || locales.en[key] || key;
  for (const [k, v] of Object.entries(vars)) {
    str = str.replace(`{${k}}`, v);
  }
  return str;
}

// --- Language selection keyboard ---
function langKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("🇬🇧 English", "lang_en")],
    [Markup.button.callback("🇺🇿 O'zbekcha", "lang_uz")],
    [Markup.button.callback("🇷🇺 Русский", "lang_ru")],
  ]);
}

bot.start(async (ctx) => {
  const userId = ctx.from.id;
  if (!userLangs[userId]) {
    return ctx.reply(
      [locales.en.chooseLang, locales.uz.chooseLang, locales.ru.chooseLang].join("\n"),
      langKeyboard()
    );
  }
  const name = ctx.from.first_name || ctx.from.username || "friend";
  return ctx.reply(t(userId, "start", { name }));
});

bot.command("lang", async (ctx) => {
  return ctx.reply(
    [locales.en.chooseLang, locales.uz.chooseLang, locales.ru.chooseLang].join("\n"),
    langKeyboard()
  );
});

bot.action(/lang_(en|uz|ru)/, async (ctx) => {
  const lang = ctx.match[1];
  setLang(ctx.from.id, lang);
  await ctx.answerCbQuery();
  await ctx.editMessageText(t(ctx.from.id, "langSet"));
  const name = ctx.from.first_name || ctx.from.username || "friend";
  return ctx.reply(t(ctx.from.id, "start", { name }));
});

// --- Show the requesting user's own Telegram info ---
bot.command("myinfo", async (ctx) => {
  const u = ctx.from;
  const userId = u.id;
  const lines = [
    t(userId, "infoTitle"),
    "",
    `${t(userId, "id")}: ${u.id}`,
    `${t(userId, "firstName")}: ${u.first_name || "-"}`,
    `${t(userId, "lastName")}: ${u.last_name || "-"}`,
    `${t(userId, "username")}: ${u.username ? "@" + u.username : t(userId, "noUsername")}`,
    `${t(userId, "langCode")}: ${u.language_code || "-"}`,
    `${t(userId, "isPremium")}: ${u.is_premium ? t(userId, "yes") : t(userId, "no")}`,
    `${t(userId, "isBot")}: ${u.is_bot ? t(userId, "yes") : t(userId, "no")}`,
  ];
  lines.push(t(userId, "note"));
  return ctx.reply(lines.join("\n"));
});

// --- Get current chat ID (useful for group admins, channel setup, etc.) ---
bot.command("chatid", async (ctx) => {
  const userId = ctx.from.id;
  const chat = ctx.chat;
  const lines = [
    `${t(userId, "chatId")}: ${chat.id}`,
    `${t(userId, "chatType")}: ${chat.type}`,
  ];
  if (chat.title) lines.push(`${t(userId, "chatTitle")}: ${chat.title}`);
  return ctx.reply(lines.join("\n"));
});

// --- If a message is forwarded, show info about the forward origin ---
// NOTE: Telegram only exposes this if the original sender allows it in their
// privacy settings. If hidden, we cannot retrieve who they are — by design.
bot.on("message", async (ctx, next) => {
  const msg = ctx.message;
  const userId = ctx.from.id;

  if (msg.forward_origin) {
    const origin = msg.forward_origin;
    let lines = [t(userId, "fwdTitle"), ""];

    if (origin.type === "user" && origin.sender_user) {
      const su = origin.sender_user;
      lines.push(`${t(userId, "id")}: ${su.id}`);
      lines.push(`${t(userId, "firstName")}: ${su.first_name || "-"}`);
      lines.push(`${t(userId, "lastName")}: ${su.last_name || "-"}`);
      lines.push(`${t(userId, "username")}: ${su.username ? "@" + su.username : t(userId, "noUsername")}`);
      lines.push(t(userId, "note"));
      return ctx.reply(lines.join("\n"));
    } else if (origin.type === "hidden_user") {
      return ctx.reply(t(userId, "fwdHidden"));
    } else if (origin.type === "chat" || origin.type === "channel") {
      const chat = origin.sender_chat || origin.chat;
      lines.push(`${t(userId, "chatId")}: ${chat?.id ?? "-"}`);
      lines.push(`${t(userId, "chatTitle")}: ${chat?.title ?? "-"}`);
      return ctx.reply(lines.join("\n"));
    }
  }

  return next();
});

bot.catch((err, ctx) => {
  console.error("Bot error:", err);
});

// --- PORT / Webhook setup ---
// Ko'p hosting xizmatlari (Render, Railway, Heroku va h.k.) bot doim ishlab
// turishi uchun ochiq PORT talab qiladi. Bu yerda 2 xil rejim bor:
//
// 1) WEBHOOK_URL .env faylida berilgan bo'lsa -> webhook + Express server
//    PORT'da ko'tariladi (hosting buni talab qiladi).
// 2) WEBHOOK_URL berilmagan bo'lsa -> oddiy polling rejimi ishlaydi
//    (lokal kompyuterda test qilish uchun qulay), lekin baribir PORT'da
//    "tirik" ekanini ko'rsatadigan kichik server ham ko'tariladi
//    (Render kabi hostinglar PORT ochilishini talab qiladi).

const PORT = process.env.PORT || 3000;
const WEBHOOK_URL = process.env.WEBHOOK_URL; // masalan: https://sizning-domain.com

const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("✅ UserInfoBot ishlayapti / is running");
});

if (WEBHOOK_URL) {
  const webhookPath = `/webhook/${BOT_TOKEN}`;
  app.use(bot.webhookCallback(webhookPath));

  app.listen(PORT, async () => {
    await bot.telegram.setWebhook(`${WEBHOOK_URL}${webhookPath}`);
    console.log(`✅ Webhook o'rnatildi: ${WEBHOOK_URL}${webhookPath}`);
    console.log(`✅ Server PORT=${PORT} da ishga tushdi`);
  });
} else {
  app.listen(PORT, () => {
    console.log(`✅ Server PORT=${PORT} da ishga tushdi (faqat "tirik" ko'rsatish uchun)`);
  });

  bot.launch().then(() => {
    console.log("✅ Bot polling rejimida ishga tushdi (started)");
  });
}

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));