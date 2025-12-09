const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 
    `mongodb://${process.env.DB_USER || ''}:${process.env.DB_PASSWORD || ''}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 27017}/${process.env.DB_NAME || 'musebot'}`;

const connectDB = async (retries = 5, delay = 5000) => {
    for (let i = 0; i < retries; i++) {
        try {
            console.log(`🔄 Спроба підключення до MongoDB... (${i + 1}/${retries})`);
            
            await mongoose.connect(MONGODB_URI, {
                serverSelectionTimeoutMS: 10000, // 10 секунд
                socketTimeoutMS: 45000,
                connectTimeoutMS: 10000,
                retryWrites: true,
                retryReads: true,
            });
            
            console.log('✅ MongoDB підключено успішно');
            return;
        } catch (error) {
            console.error(`❌ Помилка підключення до MongoDB (спроба ${i + 1}/${retries}):`, error.message);
            
            if (error.code === 'ESERVFAIL' || error.code === 'ENOTFOUND') {
                console.error('⚠️  Проблема з DNS. Перевірте:');
                console.error('   1. Інтернет-з\'єднання');
                console.error('   2. Правильність MONGODB_URI в .env файлі');
                console.error('   3. Доступність MongoDB Atlas кластера');
            }
            
            if (i < retries - 1) {
                console.log(`⏳ Очікування ${delay / 1000} секунд перед наступною спробою...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                console.error('❌ Не вдалося підключитися до MongoDB після всіх спроб');
                console.error('💡 Перевірте ваш .env файл та MONGODB_URI');
                process.exit(1);
            }
        }
    }
};

mongoose.connection.on('error', (err) => {
    console.error('MongoDB помилка:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('⚠️  MongoDB відключено. Спробую перепідключитися...');
    setTimeout(() => {
        connectDB(3, 3000);
    }, 5000);
});

mongoose.connection.on('reconnected', () => {
    console.log('✅ MongoDB перепідключено');
});

module.exports = { connectDB, mongoose };
