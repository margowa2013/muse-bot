const Order = require('../models/Order');
const cartService = require('./cartService');
const userService = require('./userService');

class OrderService {
    // Функція для парсингу дати з тексту
    parseDate(dateString) {
        if (!dateString || typeof dateString !== 'string') {
            return null;
        }

        const lowerText = dateString.toLowerCase().trim();
        
        // Обробка спеціальних слів
        if (lowerText === 'сьогодні' || lowerText === 'сегодня' || lowerText === 'today') {
            return new Date();
        }
        
        if (lowerText === 'завтра' || lowerText === 'tomorrow') {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            return tomorrow;
        }

        // Спробуємо розпарсити дату в різних форматах
        // Формат DD.MM.YYYY
        const ddmmyyyy = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;
        const match = dateString.match(ddmmyyyy);
        if (match) {
            const day = parseInt(match[1], 10);
            const month = parseInt(match[2], 10) - 1; // Місяці в JS починаються з 0
            const year = parseInt(match[3], 10);
            const date = new Date(year, month, day);
            if (!isNaN(date.getTime())) {
                return date;
            }
        }

        // Спробуємо стандартний парсинг
        const parsedDate = new Date(dateString);
        if (!isNaN(parsedDate.getTime())) {
            return parsedDate;
        }

        // Якщо не вдалося розпарсити, повертаємо null
        return null;
    }

    async createOrder(userId, dateRequested, comment) {
        // Отримуємо товари з кошика
        const cartItems = await cartService.getCartItems(userId);
        
        if (cartItems.length === 0) {
            return { success: false, message: 'Кошик порожній' };
        }

        // Формуємо позиції замовлення
        const orderItems = cartItems.map(cartItem => {
            const title = cartItem.custom_text || cartItem.title || 'Кастомне замовлення';
            const priceAmount = parseFloat(cartItem.price_amount || 0);
            const currencyId = cartItem.currency_id;

            return {
                item_id: cartItem.item_id,
                custom_text: cartItem.custom_text,
                title: title,
                price_amount: priceAmount || null,
                currency_id: currencyId
            };
        });

        // Парсимо дату
        const parsedDate = dateRequested ? this.parseDate(dateRequested) : null;

        // Створюємо замовлення
        const order = await Order.create({
            user_id: userId,
            date_requested: parsedDate,
            comment: comment,
            status: 'pending',
            items: orderItems
        });

        // Оновлюємо борг користувача
        for (const cartItem of cartItems) {
            const priceAmount = parseFloat(cartItem.price_amount || 0);
            const currencyId = cartItem.currency_id;

            if (currencyId && priceAmount > 0) {
                await userService.updateDebt(userId, currencyId, priceAmount);
            }
        }

        // Очищаємо кошик
        await cartService.clearCart(userId);

        return { success: true, orderId: order._id };
    }

    async getOrders(userId) {
        const orders = await Order.find({ user_id: userId })
            .sort({ createdAt: -1 });
        
        return orders.map(order => ({
            id: order._id,
            user_id: order.user_id,
            date_requested: order.date_requested,
            comment: order.comment,
            status: order.status,
            items_count: order.items.length,
            created_at: order.createdAt
        }));
    }
}

module.exports = new OrderService();