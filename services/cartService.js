const CartItem = require('../models/CartItem');
const Item = require('../models/Item');
const Currency = require('../models/Currency');

class CartService {
    async addToCart(userId, itemId, customText = null, categoryId = null) {
        let priceAmount = null;
        let currencyId = null;
        
        // Якщо це кастомний товар, встановлюємо ціну на основі категорії
        if (customText && !itemId) {
            const Category = require('../models/Category');
            const Currency = require('../models/Currency');
            
            // Отримуємо категорію
            let category = null;
            if (categoryId) {
                category = await Category.findById(categoryId);
            }
            
            // Знаходимо валюту "Поцілунки"
            const kissesCurrency = await Currency.findOne({ name: /поцілун/i });
            
            if (category && kissesCurrency) {
                // "Приємності" -> 6 поцілунків
                if (category.name === 'Приємності') {
                    priceAmount = 6;
                    currencyId = kissesCurrency._id;
                }
                // "Коли на відстані" -> 3 поцілунки
                else if (category.name === 'Коли на відстані') {
                    priceAmount = 3;
                    currencyId = kissesCurrency._id;
                }
            }
        }
        
        await CartItem.create({
            user_id: userId,
            item_id: itemId || null,
            custom_text: customText,
            price_amount: priceAmount,
            currency_id: currencyId
        });
    }

    async getCartItems(userId) {
        const cartItems = await CartItem.find({ user_id: userId })
            .populate({
                path: 'item_id',
                populate: {
                    path: 'currency_id',
                    select: 'name emoji'
                }
            })
            .populate({
                path: 'currency_id',
                select: 'name emoji'
            })
            .sort({ createdAt: 1 });

        return cartItems.map(ci => {
            const item = ci.item_id;
            // Для кастомних товарів використовуємо ціну з CartItem, для звичайних - з Item
            const priceAmount = ci.price_amount !== null && ci.price_amount !== undefined 
                ? ci.price_amount 
                : (item ? item.price_amount : null);
            const currencyId = ci.currency_id 
                ? ci.currency_id 
                : (item && item.currency_id ? item.currency_id : null);
            
            return {
                id: ci._id,
                item_id: item ? item._id : null,
                custom_text: ci.custom_text,
                title: item ? item.title : null,
                description: item ? item.description : null,
                photo_id: item ? item.photo_id : null,
                price_amount: priceAmount,
                currency_name: currencyId ? (typeof currencyId === 'object' ? currencyId.name : null) : null,
                currency_emoji: currencyId ? (typeof currencyId === 'object' ? currencyId.emoji : null) : null,
                currency_id: currencyId ? (typeof currencyId === 'object' ? currencyId._id : currencyId) : null
            };
        });
    }

    async removeCartItem(cartItemId, userId) {
        const result = await CartItem.deleteOne({ 
            _id: cartItemId, 
            user_id: userId 
        });
        return result.deletedCount > 0;
    }

    async clearCart(userId) {
        await CartItem.deleteMany({ user_id: userId });
    }

    async getCartTotal(userId) {
        const items = await this.getCartItems(userId);
        const totals = {};
        
        items.forEach(item => {
            // Враховуємо товари з ціною (включаючи кастомні)
            if (item.price_amount !== null && item.price_amount !== undefined) {
                const price = parseFloat(item.price_amount || 0);
                if (price > 0) {
                    const currencyName = item.currency_name || 'Поцілунки';
                    const key = `${item.currency_id || 'default'}_${currencyName}`;
                    if (!totals[key]) {
                        totals[key] = {
                            currency_id: item.currency_id,
                            currency_name: currencyName,
                            currency_emoji: item.currency_emoji || '💋',
                            amount: 0
                        };
                    }
                    totals[key].amount += price;
                }
            }
        });

        return Object.values(totals);
    }
}

module.exports = new CartService();