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

async function backupDatabase() {
    try {
        await connectDB();
        console.log('💾 Створення резервної копії бази даних...\n');

        // Створюємо папку для резервних копій
        const backupDir = path.join(__dirname, 'backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        // Створюємо папку з датою та часом
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
                         new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
        const backupPath = path.join(backupDir, `backup_${timestamp}`);
        fs.mkdirSync(backupPath, { recursive: true });

        console.log(`📁 Створено папку: ${backupPath}\n`);

        // Експортуємо всі колекції
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

        let totalRecords = 0;

        for (const collection of collections) {
            try {
                const data = await collection.model.find({}).lean();
                const filePath = path.join(backupPath, `${collection.name}.json`);
                
                // Конвертуємо ObjectId в рядки для JSON
                const jsonData = JSON.stringify(data, (key, value) => {
                    if (value && value._id && typeof value._id === 'object') {
                        return { ...value, _id: value._id.toString() };
                    }
                    if (value && typeof value === 'object' && value.constructor.name === 'ObjectId') {
                        return value.toString();
                    }
                    return value;
                }, 2);

                fs.writeFileSync(filePath, jsonData, 'utf8');
                console.log(`✅ ${collection.name}: ${data.length} записів`);
                totalRecords += data.length;
            } catch (error) {
                console.error(`❌ Помилка експорту ${collection.name}:`, error.message);
            }
        }

        // Створюємо файл з інформацією про резервну копію
        const info = {
            timestamp: new Date().toISOString(),
            database: mongoose.connection.name,
            totalRecords: totalRecords,
            collections: collections.map(c => c.name)
        };

        fs.writeFileSync(
            path.join(backupPath, 'backup_info.json'),
            JSON.stringify(info, null, 2),
            'utf8'
        );

        console.log(`\n✅ Резервна копія успішно створена!`);
        console.log(`📊 Всього записів: ${totalRecords}`);
        console.log(`📁 Розташування: ${backupPath}`);
        console.log(`\n💡 Для відновлення використайте: node database/restore.js ${backupPath}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Помилка створення резервної копії:', error);
        process.exit(1);
    }
}

backupDatabase();

