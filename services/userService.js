const User = require('../models/User');
const UserDebt = require('../models/UserDebt');
const Currency = require('../models/Currency');
const PaymentHistory = require('../models/PaymentHistory');

class UserService {
    async getOrCreateUser(userId, username, firstName) {
        // Спочатку намагаємося знайти існуючого користувача
        let user = await User.findOne({ user_id: userId });
        
        if (user) {
            // Оновлюємо username та first_name, якщо вони передані
            const updateFields = {};
            if (username !== undefined) {
                updateFields.username = username || null;
            }
            if (firstName !== undefined) {
                updateFields.first_name = firstName || null;
            }
            
            if (Object.keys(updateFields).length > 0) {
                await User.updateOne({ user_id: userId }, { $set: updateFields });
                user = await User.findOne({ user_id: userId });
            }
            
            return { 
                isFirstTime: user.is_first_time,
                user: user
            };
        }

        // Якщо користувача немає, створюємо нового
        // Використовуємо findOneAndUpdate з upsert для атомарної операції
        // Це запобігає race condition та помилкам дублікату ключа
        try {
            user = await User.findOneAndUpdate(
                { user_id: userId },
                {
                    $setOnInsert: {
                        user_id: userId,
                        username: username || null,
                        first_name: firstName || null,
                        is_first_time: true
                    }
                },
                {
                    upsert: true,
                    new: true,
                    setDefaultsOnInsert: true
                }
            );
            
            return { 
                isFirstTime: true,
                user: user
            };
        } catch (error) {
            // Якщо виникла помилка дублікату (race condition), просто знаходимо користувача
            if (error.code === 11000) {
                user = await User.findOne({ user_id: userId });
                return { 
                    isFirstTime: user ? user.is_first_time : false,
                    user: user
                };
            }
            throw error;
        }
    }

    async markUserAsReturning(userId) {
        await User.updateOne(
            { user_id: userId },
            { $set: { is_first_time: false } }
        );
    }

    async getUserDebts(userId) {
        const debts = await UserDebt.find({ 
            user_id: userId, 
            amount: { $gt: 0 } 
        }).populate('currency_id', 'name emoji');
        
        return debts.map(debt => ({
            amount: debt.amount,
            name: debt.currency_id.name,
            emoji: debt.currency_id.emoji,
            currency_id: debt.currency_id._id
        }));
    }

    async updateDebt(userId, currencyId, amount) {
        await UserDebt.findOneAndUpdate(
            { user_id: userId, currency_id: currencyId },
            { 
                $inc: { amount: amount },
                $setOnInsert: { user_id: userId, currency_id: currencyId }
            },
            { upsert: true, new: true }
        );
    }

    async getUsersWithDebts() {
        // Знаходимо всіх користувачів, у яких є борги
        const debts = await UserDebt.find({ 
            amount: { $gt: 0 } 
        }).distinct('user_id');
        
        if (debts.length === 0) {
            return [];
        }
        
        // Отримуємо інформацію про користувачів
        const users = await User.find({ 
            user_id: { $in: debts } 
        });
        
        // Для кожного користувача отримуємо загальну суму боргів
        const usersWithDebts = await Promise.all(
            users.map(async (user) => {
                const userDebts = await this.getUserDebts(user.user_id);
                const totalDebt = userDebts.reduce((sum, debt) => sum + debt.amount, 0);
                
                return {
                    user_id: user.user_id,
                    username: user.username,
                    first_name: user.first_name,
                    debts_count: userDebts.length,
                    total_debt: totalDebt,
                    debts: userDebts
                };
            })
        );
        
        // Сортуємо за загальною сумою боргу (від більшого до меншого)
        return usersWithDebts.sort((a, b) => b.total_debt - a.total_debt);
    }

    async payDebt(userId, currencyId, amount) {
        console.log('🔍 [DEBUG] payDebt викликано з параметрами:');
        console.log('🔍 [DEBUG] - userId:', userId, '(тип:', typeof userId, ')');
        console.log('🔍 [DEBUG] - currencyId:', currencyId, '(тип:', typeof currencyId, ')');
        console.log('🔍 [DEBUG] - amount:', amount, '(тип:', typeof amount, ')');
        
        // Конвертуємо currencyId в ObjectId, якщо потрібно
        const mongoose = require('mongoose');
        let currencyIdObject;
        
        if (currencyId instanceof mongoose.Types.ObjectId) {
            currencyIdObject = currencyId;
            console.log('🔍 [DEBUG] currencyId вже ObjectId');
        } else if (typeof currencyId === 'string' && mongoose.Types.ObjectId.isValid(currencyId)) {
            currencyIdObject = new mongoose.Types.ObjectId(currencyId);
            console.log('🔍 [DEBUG] Конвертовано currencyId з рядка в ObjectId');
        } else if (typeof currencyId === 'object' && currencyId._id) {
            currencyIdObject = currencyId._id;
            console.log('🔍 [DEBUG] Взято _id з об\'єкта currencyId');
        } else {
            console.error('❌ [ERROR] Неможливо конвертувати currencyId в ObjectId');
            console.log('🔍 [DEBUG] currencyId структура:', JSON.stringify(currencyId, null, 2));
            return { success: false, message: `Помилка: невірний формат валюти. Тип: ${typeof currencyId}` };
        }
        
        console.log('🔍 [DEBUG] Шукаємо борг з параметрами:');
        console.log('🔍 [DEBUG] - user_id:', userId);
        console.log('🔍 [DEBUG] - currency_id:', currencyIdObject);
        
        const debt = await UserDebt.findOne({ 
            user_id: userId, 
            currency_id: currencyIdObject 
        });

        console.log('🔍 [DEBUG] Знайдено борг:', debt ? JSON.stringify({
            _id: debt._id,
            user_id: debt.user_id,
            currency_id: debt.currency_id,
            amount: debt.amount
        }, null, 2) : 'не знайдено');

        if (!debt) {
            console.error('❌ [ERROR] Борг не знайдено в базі даних');
            // Спробуємо знайти всі борги цього користувача для діагностики
            const allDebts = await UserDebt.find({ user_id: userId });
            console.log('🔍 [DEBUG] Всі борги користувача:', JSON.stringify(allDebts.map(d => ({
                _id: d._id,
                user_id: d.user_id,
                currency_id: d.currency_id,
                amount: d.amount
            })), null, 2));
            return { success: false, message: 'Немає боргу за цією валютою' };
        }
        
        if (debt.amount <= 0) {
            console.error('❌ [ERROR] Борг має нульову або від\'ємну суму:', debt.amount);
            return { success: false, message: 'Борг вже погашено' };
        }

        const currentDebt = debt.amount;
        const newAmount = Math.max(0, currentDebt - amount);

        await UserDebt.updateOne(
            { user_id: userId, currency_id: currencyId },
            { $set: { amount: newAmount } }
        );

        await PaymentHistory.create({
            user_id: userId,
            currency_id: currencyId,
            amount: amount
        });

        return { success: true, newAmount };
    }
}

module.exports = new UserService();