# UserInfoBot (EN / UZ / RU)

Telegram bot built with Telegraf that shows a user their **own** account info
(ID, name, username, language code, premium status), supports forwarded-message
sender lookup (only when the sender allows it via their privacy settings), and
works in English, Uzbek, and Russian.

## ⚠️ Important limitation (by design)

Telegram's Bot API does **not** expose, for any user:
- account creation date
- username change history
- profile photo change history
- a list of all past names/usernames

This isn't a missing feature — Telegram intentionally doesn't give bots this
data, to protect user privacy. Any "bot" or service claiming to show this
information for arbitrary account IDs is using leaked/scraped data, which
violates Telegram's Terms of Service and is illegal in most countries. This
bot only shows what Telegram's official API legitimately provides.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a bot with [@BotFather](https://t.me/BotFather) and get your token.

3. Copy `.env.example` to `.env` and paste your token:
   ```bash
   cp .env.example .env
   ```
   Edit `.env`:
   ```
   BOT_TOKEN=123456789:your_real_token_here
   ```

4. Run the bot:
   ```bash
   npm start
   ```

## Commands

- `/start` — greets the user, asks for language on first use
- `/lang` — change language (EN / UZ / RU)
- `/myinfo` — shows the requesting user's own Telegram info
- `/chatid` — shows the current chat's ID and type
- Forward any message to the bot — it will try to show info about the
  original sender, if their privacy settings allow it

## Files

- `index.js` — bot logic
- `locales.js` — EN/UZ/RU text strings
- `userlangs.json` — auto-created, stores each user's language choice
# my-id-bot
