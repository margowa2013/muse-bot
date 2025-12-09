const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { connectDB } = require('../config/database');

// Імпортуємо всі моделі
const Category = require('../models/Category');
const Subcategory = require('../models/Subcategory');
const Item = require('../models/Item');
const Currency = require('../models/Currency');
const User = require('../models/User');
const CartItem = require('../models/CartItem');
const Order = require('../models/Order');
const SpecialMenu = require('../models/SpecialMenu');
const PaymentHistory = require('../models/PaymentHistory');
const UserDebt = require('../models/UserDebt');

async function restoreDatabase(backupPath) {
    try {
        if (!backupPath) {
            console.error('❌ Помилка: не вказано шлях до резервної копії');
            console.log('💡 Використання: node database/restore.js <шлях_до_резервної_копії>');
            process.exit(1);
        }

        // Перевіряємо, чи існує папка з резервною копією
        if (!fs.existsSync(backupPath)) {
            console.error(`❌ Помилка: папка "${backupPath}" не існує`);
            process.exit(1);
        }

        // Перевіряємо наявність файлу з інформацією
        const infoPath = path.join(backupPath, 'backup_info.json');
        if (fs.existsSync(infoPath)) {
            const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
            console.log('📋 Інформація про резервну копію:');
            console.log(`   Дата створення: ${info.timestamp}`);
            console.log(`   База даних: ${info.database}`);
            console.log(`   Всього записів: ${info.totalRecords}`);
            console.log(`   Колекції: ${info.collections.join(', ')}\n`);
        }

        await connectDB();
        console.log('🔄 Відновлення бази даних...\n');

        // Мапінг колекцій
        const collections = [
            { name: 'categories', model: Category },
            { name: 'subcategories', model: Subcategory },
            { name: 'items', model: Item },
            { name: 'currencies', model: Currency },
            { name: 'users', model: User },
            { name: 'cartitems', model: CartItem },
            { name: 'orders', model: Order },
            { name: 'specialmenus', model: SpecialMenu },
            { name: 'paymenthistories', model: PaymentHistory },
            { name: 'userdebts', model: UserDebt }
        ];

        let totalRestored = 0;

        for (const collection of collections) {
            try {
                const filePath = path.join(backupPath, `${collection.name}.json`);
                
                if (!fs.existsSync(filePath)) {
                    console.log(`⚠️  Файл ${collection.name}.json не знайдено, пропускаємо`);
                    continue;
                }

                const jsonData = fs.readFileSync(filePath, 'utf8');
                const data = JSON.parse(jsonData);

                if (data.length === 0) {
                    console.log(`ℹ️  ${collection.name}: немає даних для відновлення`);
                    continue;
                }

                // Очищаємо колекцію перед відновленням
                await collection.model.deleteMany({});

                // Відновлюємо дані
                // Конвертуємо рядки назад в ObjectId
                const documents = data.map(doc => {
                    const processed = { ...doc };
                    // Обробляємо _id та інші ObjectId поля
                    if (processed._id && typeof processed._id === 'string') {
                        processed._id = new mongoose.Types.ObjectId(processed._id);
                    }
                    // Обробляємо інші ObjectId поля (category_id, subcategory_id, тощо)
                    Object.keys(processed).forEach(key => {
                        if (key.endsWith('_id') && processed[key] && typeof processed[key] === 'string' && mongoose.Types.ObjectId.isValid(processed[key])) {
                            processed[key] = new mongoose.Types.ObjectId(processed[key]);
                        }
                    });
                    return processed;
                });

                await collection.model.insertMany(documents);
                console.log(`✅ ${collection.name}: відновлено ${documents.length} записів`);
                totalRestored += documents.length;
            } catch (error) {
                console.error(`❌ Помилка відновлення ${collection.name}:`, error.message);
            }
        }

        console.log(`\n✅ Відновлення завершено!`);
        console.log(`📊 Всього відновлено записів: ${totalRestored}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Помилка відновлення бази даних:', error);
        process.exit(1);
    }
}

// Отримуємо шлях з аргументів командного рядка
const backupPath = process.argv[2];
restoreDatabase(backupPath);

