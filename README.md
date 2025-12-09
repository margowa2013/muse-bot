# 💕 MuseBot – a romantic Telegram bot for couples

MuseBot is a playful Telegram bot for two people. Partners can order care, dates, food, or sweet gestures and “pay” with kisses, hugs, or other in-app currencies. Admins can curate the menu, manage debts, and publish special offers right from Telegram.

## Features
- Guided onboarding with `/start`, main menu, and reply keyboards.
- Categories, subcategories, gallery-style item browsing, and a cart with checkout flow (date + comment).
- Account page that shows debts per currency and totals.
- Partner notifications: when one partner orders, the other gets a message (if `USER_1_ID` and `USER_2_ID` are set).
- Admin panel (`/admin`): add/edit items (with photos/gifs/videos), view orders, subtract debts, and publish “special menu” posts.
- Built-in backup/restore scripts for MongoDB data and a script to bulk-upload local media to Telegram.

## Tech stack
- Node.js + CommonJS
- MongoDB via Mongoose
- `node-telegram-bot-api`
- Express (for future webhook support; polling by default)

## Project structure
```
config/            # Constants and Mongo connection helper
database/          # Seeds, backups, media upload helper, date ideas
handlers/          # Telegram handlers: menu, callbacks, admin
helpers/           # Keyboards, messages, callback safety helpers
models/            # Mongoose models
services/          # Business logic (menu, cart, orders, users, admin)
index.js           # Bot entry point (polling)
env.example        # Copy to .env and fill
```

## Prerequisites
- Node.js 16+
- MongoDB 4.4+ (local or Atlas)
- Telegram Bot Token from [@BotFather](https://t.me/BotFather)

## Setup
1) Clone and install:
```bash
git clone <repository-url>
cd lovep-tg
npm install
```
2) Configure environment: copy `env.example` → `.env` and fill it (see below).
3) Start MongoDB (local) or have Atlas URL ready.
4) Seed base data (idempotent, safe to rerun):
```bash
node database/init.js       # currencies, categories, subcategories
node database/seedItems.js  # demo items with prices and media URLs
```
5) Run the bot:
```bash
npm start           # production / polling
npm run dev         # watch mode for local development
```

## Environment variables
Required:
- `BOT_TOKEN` – Telegram bot token.
- `MONGODB_URI` – connection string (or set DB_* parts below).
- `ADMIN_USER_ID` – comma-separated admin Telegram user IDs for `/admin`.

Optional:
- `USER_1_ID`, `USER_2_ID` – partner IDs for cross-notifications.
- `ORDER_CONFIRMATION_GIF_ID` – Telegram `file_id` for the confirmation GIF (defaults to a bundled ID).
- `TELEGRAM_BOT_TOKEN`, `ADMIN_CHAT_ID` – only needed for `database/uploadMedia.js`; you can reuse `BOT_TOKEN` and your own user ID.
- `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `DB_NAME` – alternative way to build the Mongo URI if you don’t set `MONGODB_URI`.

## Admin workflow
- Send `/admin` from an allowed account.
- Use the menu to add/edit items (supports photos/gifs/videos), view orders, subtract debts, or publish a special menu post.
- “Back to menu” buttons clear admin/user state and return to the main menu.

## Media upload
- Recommended: send media through the admin panel when adding/editing an item; the bot saves the `file_id` automatically.
- Bulk (optional): place files in `database/media/`, set `TELEGRAM_BOT_TOKEN` and `ADMIN_CHAT_ID`, then run `node database/uploadMedia.js`. Files are matched to items by name similarity and uploaded to Telegram; `photo_id` is saved in Mongo.

## Backups & restore
- Backup all collections to dated folder: `npm run backup`
- Backup and zip archive: `npm run backup:archive`
- Restore from a backup folder: `npm run restore <path-to-backup-folder>`

## Deployment
- Set env vars (`BOT_TOKEN`, `MONGODB_URI`, `ADMIN_USER_ID`, optional partner IDs/GIF).
- Run the seeds once (`database/init.js` then `database/seedItems.js`).
- Start the app with `npm start` (or use PM2/systemd). Polling is enabled by default; switch to webhooks if your host supports it.

## Scripts
- `npm start` – run the bot (polling).
- `npm run dev` – run with `node --watch`.
- `npm run backup` / `npm run backup:archive` – create backups (JSON / ZIP).
- `npm run restore` – restore from a backup folder.

## License
ISC

## Author
kun3741

