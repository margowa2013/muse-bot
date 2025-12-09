/**
 * Скрипт для завантаження медіафайлів з Google Photos в Telegram
 * 
 * Інструкція:
 * 1. Завантажте всі фото/гіфки з Google Photos локально
 * 2. Встановіть Telegram Bot API token в .env
 * 3. Запустіть скрипт: node database/uploadMedia.js
 * 
 * АБО використайте альтернативний метод:
 * - Відправте фото/гіфки боту через адмін-панель
 * - Скрипт автоматично збереже file_id в базу даних
 */

const mongoose = require('mongoose');
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();
const { connectDB } = require('../config/database');
const Item = require('../models/Item');
const fs = require('fs');
const path = require('path');

async function uploadMedia() {
    try {
        await connectDB();
        console.log('Підключено до бази даних');

        if (!process.env.TELEGRAM_BOT_TOKEN) {
            throw new Error('TELEGRAM_BOT_TOKEN не встановлено в .env');
        }

        const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
        const adminChatId = process.env.ADMIN_CHAT_ID; // ID адміністратора для завантаження

        if (!adminChatId) {
            console.log('⚠️  ADMIN_CHAT_ID не встановлено. Використовуйте адмін-панель для завантаження фото.');
            console.log('📝 Альтернативний метод:');
            console.log('   1. Відкрийте бота');
            console.log('   2. Використайте /admin → Додати товар');
            console.log('   3. Виберіть товар і надішліть фото');
            return;
        }

        // Отримуємо всі товари з photo_url
        const items = await Item.find({ 
            photo_url: { $exists: true, $ne: '' },
            photo_id: { $in: [null, ''] }
        });

        console.log(`Знайдено ${items.length} товарів для завантаження медіа`);

        if (items.length === 0) {
            console.log('✅ Всі медіафайли вже завантажені');
            return;
        }

        console.log('\n⚠️  УВАГА: Цей скрипт потребує локальних файлів.');
        console.log('📥 Завантажте фото/гіфки з Google Photos локально');
        console.log('📁 Розмістіть їх у папці database/media/');
        console.log('📝 Назвіть файли відповідно до назв товарів\n');

        // Перевіряємо наявність папки
        const mediaDir = path.join(__dirname, 'media');
        if (!fs.existsSync(mediaDir)) {
            fs.mkdirSync(mediaDir, { recursive: true });
            console.log('📁 Створено папку database/media/');
            console.log('📥 Завантажте туди фото/гіфки та запустіть скрипт знову\n');
            return;
        }

        // Список файлів у папці
        const files = fs.readdirSync(mediaDir);
        console.log(`Знайдено ${files.length} файлів у папці media/`);

        // Мапінг назв товарів до файлів (можна налаштувати)
        const itemFileMap = {};
        for (const item of items) {
            // Шукаємо файл за назвою товару
            const matchingFile = files.find(f => {
                const fileName = f.toLowerCase().replace(/[^a-zа-я0-9]/g, '');
                const itemName = item.title.toLowerCase().replace(/[^a-zа-я0-9]/g, '');
                return fileName.includes(itemName) || itemName.includes(fileName);
            });

            if (matchingFile) {
                itemFileMap[item._id.toString()] = path.join(mediaDir, matchingFile);
            }
        }

        console.log(`\nЗнайдено ${Object.keys(itemFileMap).length} відповідностей`);

        // Завантажуємо файли
        for (const [itemId, filePath] of Object.entries(itemFileMap)) {
            try {
                const item = items.find(i => i._id.toString() === itemId);
                if (!item) continue;

                console.log(`\n📤 Завантаження: ${item.title}`);
                
                // Визначаємо тип файлу
                const ext = path.extname(filePath).toLowerCase();
                let fileId;

                if (['.gif', '.mp4', '.mov'].includes(ext)) {
                    // Відео/гіфка
                    const videoStream = fs.createReadStream(filePath);
                    const sent = await bot.sendVideo(adminChatId, videoStream);
                    fileId = sent.video.file_id;
                } else {
                    // Фото
                    const photoStream = fs.createReadStream(filePath);
                    const sent = await bot.sendPhoto(adminChatId, photoStream);
                    fileId = sent.photo[sent.photo.length - 1].file_id;
                }

                // Оновлюємо товар
                await Item.updateOne(
                    { _id: itemId },
                    { $set: { photo_id: fileId } }
                );

                console.log(`✅ Завантажено: ${item.title}`);
            } catch (error) {
                console.error(`❌ Помилка завантаження ${item.title}:`, error.message);
            }
        }

        console.log('\n✅ Завантаження завершено!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Помилка:', error);
        process.exit(1);
    }
}

// Якщо скрипт запущено напряму
if (require.main === module) {
    uploadMedia();
}

module.exports = { uploadMedia };

