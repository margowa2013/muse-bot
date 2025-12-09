const cartService = require('../services/cartService');
const orderService = require('../services/orderService');
const Keyboards = require('../helpers/keyboards');
const Messages = require('../helpers/messages');
const { getPartnerId, isCoupleUser } = require('../config/constants');
const { safeAnswerCallbackQuery } = require('../helpers/callbackHelper');

class CallbackHandlers {
    constructor(bot, menuHandlers) {
        this.bot = bot;
        this.menuHandlers = menuHandlers;
        this.userStates = new Map();
    }

    async handleCallback(query) {
        const userId = query.from.id;
        const data = query.data;

        try {
            // Крутити рулетку для рандомного побачення
            if (data.startsWith('spin_roulette_')) {
                await this.handleSpinRoulette(userId, data, query);
            }
            // Додати в кошик (з рандомною ідеєю)
            else if (data.startsWith('add_to_cart_random_')) {
                await this.handleAddRandomToCart(userId, data, query.id);
            }
            // Додати в кошик
            else if (data.startsWith('add_to_cart_')) {
                await this.handleAddToCart(userId, data, query.id);
            }
            // Видалити з кошика
            else if (data.startsWith('remove_cart_')) {
                await this.handleRemoveFromCart(userId, data, query);
            }
            // Очистити кошик
            else if (data === 'clear_cart') {
                await this.handleClearCart(userId, query.id, query.message);
            }
            // Оформити замовлення
            else if (data === 'checkout') {
                await this.handleCheckout(userId, query.id, query.message);
            }
            // Оформити замовлення зі спецменю
            else if (data === 'order_special_menu') {
                await this.handleOrderSpecialMenu(userId, query.id, query.message);
            }
        // Назад до меню
        else if (data === 'back_to_menu') {
            await this.handleBackToMenu(userId, query.message);
            await safeAnswerCallbackQuery(this.bot, query.id);
        }
            // Назад до підкатегорії
            else if (data === 'back_to_subcategory') {
                // Очищаємо стан очікування кастомного тексту при поверненні назад
                const menuState = this.menuHandlers.getUserState(userId);
                if (menuState && menuState.waitingForCustomText) {
                    this.menuHandlers.clearUserState(userId);
                }
                await this.handleBackToSubcategory(userId, query.message);
                await safeAnswerCallbackQuery(this.bot, query.id);
            }
            // Галерея - попередній
            else if (data.startsWith('gallery_prev_')) {
                const index = parseInt(data.split('_')[2]);
                await this.menuHandlers.showGalleryItem(this.bot, userId, index, query.message);
                await safeAnswerCallbackQuery(this.bot, query.id);
            }
            // Галерея - наступний
            else if (data.startsWith('gallery_next_')) {
                const index = parseInt(data.split('_')[2]);
                await this.menuHandlers.showGalleryItem(this.bot, userId, index, query.message);
                await safeAnswerCallbackQuery(this.bot, query.id);
            }
            // Інформація про галерею
            else if (data === 'gallery_info') {
                await safeAnswerCallbackQuery(this.bot, query.id, { text: 'Переглядайте товари' });
            }
        } catch (error) {
            console.error('Error handling callback:', error);
            await safeAnswerCallbackQuery(this.bot, query.id, { text: 'Помилка. Спробуйте ще раз.' });
        }
    }
    
    async handleSpinRoulette(userId, data, query) {
        const mongoose = require('mongoose');
        const menuService = require('../services/menuService');
        const dateIdeas = require('../database/dateIdeas');
        const Keyboards = require('../helpers/keyboards');
        const Messages = require('../helpers/messages');
        
        const itemId = data.replace('spin_roulette_', '');
        
        if (!mongoose.Types.ObjectId.isValid(itemId)) {
            await safeAnswerCallbackQuery(this.bot, query.id, { text: 'Помилка' });
            return;
        }

        // Отримуємо товар
        const item = await menuService.getItemById(itemId);
        
        if (!item || item.title !== 'Рандомное для нас двоих') {
            await safeAnswerCallbackQuery(this.bot, query.id, { text: 'Помилка' });
            return;
        }

        // Генеруємо рандомну ідею
        const randomIdea = dateIdeas[Math.floor(Math.random() * dateIdeas.length)];
        
        // Зберігаємо рандомну ідею в стані користувача
        const state = this.userStates.get(userId) || {};
        state.randomDateIdea = randomIdea;
        state.randomDateItemId = itemId;
        this.userStates.set(userId, state);
        
        // Формуємо текст з рандомною ідеєю
        const text = `*${item.title}*\n\n🎲 *Рандомна ідея:*\n${randomIdea}`;
        
        // Створюємо клавіатуру з кнопкою додати в кошик (без ідеї в callback_data)
        const keyboard = Keyboards.getRandomDateKeyboard(itemId);
        
        // Оновлюємо повідомлення
        const messageId = this.menuHandlers.userMessages.get(userId);
        const message = messageId ? { message_id: messageId } : query.message;
        
        if (item.video_id) {
            await this.menuHandlers.editOrSendMedia(this.bot, userId, message, 'video', item.video_id, text, keyboard);
        } else if (item.photo_id) {
            if (item.media_type === 'gif') {
                await this.menuHandlers.editOrSendMedia(this.bot, userId, message, 'animation', item.photo_id, text, keyboard);
            } else {
                await this.menuHandlers.editOrSendMedia(this.bot, userId, message, 'photo', item.photo_id, text, keyboard);
            }
        } else {
            await this.menuHandlers.editOrSendMessage(this.bot, userId, message, text, keyboard);
        }
        
        await safeAnswerCallbackQuery(this.bot, query.id, { text: '🎲 Рулетка прокручена!' });
    }
    
    async handleAddRandomToCart(userId, data, queryId) {
        const mongoose = require('mongoose');
        const cartService = require('../services/cartService');
        
        // Формат: add_to_cart_random_ITEMID
        const itemId = data.replace('add_to_cart_random_', '');
        
        if (!mongoose.Types.ObjectId.isValid(itemId)) {
            await safeAnswerCallbackQuery(this.bot, queryId, { text: 'Помилка додавання' });
            return;
        }

        // Отримуємо рандомну ідею зі стану користувача
        const state = this.userStates.get(userId) || {};
        const randomIdea = state.randomDateIdea;
        
        if (!randomIdea) {
            // Якщо ідеї немає в стані, генеруємо нову
            const dateIdeas = require('../database/dateIdeas');
            const newIdea = dateIdeas[Math.floor(Math.random() * dateIdeas.length)];
            await cartService.addToCart(userId, itemId, newIdea);
            await safeAnswerCallbackQuery(this.bot, queryId, { 
                text: `✅ Додано: ${newIdea}`,
                show_alert: false
            });
        } else {
            // Додаємо в кошик з рандомною ідеєю зі стану
            await cartService.addToCart(userId, itemId, randomIdea);
            await safeAnswerCallbackQuery(this.bot, queryId, { 
                text: `✅ Додано: ${randomIdea}`,
                show_alert: false
            });
            // Очищаємо ідею зі стану після додавання
            delete state.randomDateIdea;
            delete state.randomDateItemId;
            this.userStates.set(userId, state);
        }
    }

    async handleAddToCart(userId, data, queryId) {
        const mongoose = require('mongoose');
        const cartService = require('../services/cartService');
        const itemId = data.split('_')[3];
        
        if (!mongoose.Types.ObjectId.isValid(itemId)) {
            await safeAnswerCallbackQuery(this.bot, queryId, { text: 'Помилка додавання' });
            return;
        }

        // Додаємо в кошик (для звичайних товарів)
        await cartService.addToCart(userId, itemId);
        await safeAnswerCallbackQuery(this.bot, queryId, { text: '✅ Додано в кошик!' });
    }

    async handleRemoveFromCart(userId, data, query) {
        const mongoose = require('mongoose');
        const cartItemId = data.split('_')[2];
        
        if (!mongoose.Types.ObjectId.isValid(cartItemId)) {
            await safeAnswerCallbackQuery(this.bot, query.id, { text: 'Помилка видалення' });
            return;
        }
        
        const removed = await cartService.removeCartItem(cartItemId, userId);
        
        if (removed) {
            await safeAnswerCallbackQuery(this.bot, query.id, { text: '✅ Видалено' });
            // Оновлюємо повідомлення кошика
            const cartText = await Messages.formatCart(userId);
            const items = await cartService.getCartItems(userId);
            const keyboard = Keyboards.getCartKeyboard(items);
            
            await this.bot.editMessageText(cartText, {
                chat_id: query.message.chat.id,
                message_id: query.message.message_id,
                ...keyboard,
                parse_mode: 'Markdown'
            });
        } else {
            await safeAnswerCallbackQuery(this.bot, query.id, { text: 'Помилка видалення' });
        }
    }

    async handleClearCart(userId, queryId, message = null) {
        await cartService.clearCart(userId);
        await safeAnswerCallbackQuery(this.bot, queryId, { text: '✅ Кошик очищено' });
        
        if (message && message.message_id) {
            try {
                await this.bot.editMessageText('🛒 Кошик очищено', {
                    chat_id: userId,
                    message_id: message.message_id,
                    ...Keyboards.getMainMenu()
                });
                this.menuHandlers.userMessages.set(userId, message.message_id);
                return;
            } catch (error) {
                // Якщо не вдалося відредагувати, відправляємо нове
            }
        }
        
        const sent = await this.bot.sendMessage(userId, 
            '🛒 Кошик очищено',
            Keyboards.getMainMenu()
        );
        this.menuHandlers.userMessages.set(userId, sent.message_id);
    }

    async handleCheckout(userId, queryId, message = null) {
        const items = await cartService.getCartItems(userId);
        
        if (items.length === 0) {
            await safeAnswerCallbackQuery(this.bot, queryId, { text: 'Кошик порожній' });
            return;
        }

        // Встановлюємо стан очікування дати
        this.userStates.set(userId, { waitingForDate: true });
        
        await safeAnswerCallbackQuery(this.bot, queryId);
        
        if (message && message.message_id) {
            try {
                await this.bot.editMessageText('Любимый, оставь комментарий на когда хотел бы оформить заказ, и не забудь добавить комплимент твоему шефу-Му́зе 💌', {
                    chat_id: userId,
                    message_id: message.message_id,
                    ...Keyboards.getCancelKeyboard('cancel_order')
                });
                return;
            } catch (error) {
                // Якщо не вдалося відредагувати, відправляємо нове
            }
        }
        
        const sent = await this.bot.sendMessage(userId, 
            'Любимый, оставь комментарий на когда хотел бы оформить заказ, и не забудь добавить комплимент твоему шефу-Му́зе 💌',
            Keyboards.getCancelKeyboard('cancel_order')
        );
        this.menuHandlers.userMessages.set(userId, sent.message_id);
    }

    async handleBackToMenu(userId, message = null) {
        // Очищаємо всі стани користувача, включаючи стан очікування кастомного тексту
        const menuState = this.menuHandlers.getUserState(userId);
        if (menuState && menuState.waitingForCustomText) {
            this.menuHandlers.clearUserState(userId);
        } else {
            this.menuHandlers.clearUserState(userId);
        }
        this.userStates.delete(userId);
        this.menuHandlers.userMessages.delete(userId);
        
        if (message && message.message_id) {
            try {
                await this.bot.editMessageText('Головне меню:', {
                    chat_id: userId,
                    message_id: message.message_id,
                    ...Keyboards.getMainMenu()
                });
                return;
            } catch (error) {
                // Якщо не вдалося відредагувати, відправляємо нове
            }
        }
        
        const sent = await this.bot.sendMessage(userId, 
            'Головне меню:',
            Keyboards.getMainMenu()
        );
        this.menuHandlers.userMessages.set(userId, sent.message_id);
    }

    async handleBackToSubcategory(userId, message = null) {
        // Повертаємось до підкатегорій
        const state = this.menuHandlers.getUserState(userId);
        if (state && state.categoryId) {
            const Category = require('../models/Category');
            const category = await Category.findById(state.categoryId);
            if (category) {
                await this.menuHandlers.handleCategory(this.bot, { from: { id: userId } }, category.name, message);
            } else {
                await this.handleBackToMenu(userId, message);
            }
        } else {
            await this.handleBackToMenu(userId, message);
        }
    }

    // Обробка введення дати/коментаря (тепер все в одному повідомленні)
    async handleDateInput(userId, text) {
        const state = this.userStates.get(userId);
        if (!state || !state.waitingForDate) {
            return false;
        }

        const messageId = this.menuHandlers.userMessages.get(userId);
        const message = messageId ? { message_id: messageId } : null;

        // Парсимо дату з тексту, якщо можливо
        const orderService = require('../services/orderService');
        let parsedDate = null;
        let comment = text || null;
        
        // Спробуємо знайти дату в тексті
        // Шукаємо ключові слова на початку або в кінці тексту
        const datePatterns = [
            /^(сьогодні|сегодня|today)[\s,\.\-]*/i,
            /^(завтра|tomorrow)[\s,\.\-]*/i,
            /^(\d{1,2}\.\d{1,2}\.\d{4})[\s,\.\-]*/,
            /[\s,\.\-]*(сьогодні|сегодня|today)$/i,
            /[\s,\.\-]*(завтра|tomorrow)$/i,
            /[\s,\.\-]*(\d{1,2}\.\d{1,2}\.\d{4})$/,
        ];
        
        let foundDate = null;
        for (const pattern of datePatterns) {
            const match = text.match(pattern);
            if (match) {
                foundDate = match[1] || match[0].trim();
                // Видаляємо дату з коментаря
                comment = text.replace(pattern, '').trim();
                break;
            }
        }
        
        if (foundDate) {
            parsedDate = orderService.parseDate(foundDate);
        }
        
        // Якщо дата не знайдена, весь текст залишається як коментар
        if (!parsedDate && !comment) {
            comment = text;
        }
        
        // Отримуємо товари з кошика перед створенням замовлення (для повідомлення партнеру)
        const cartItems = await cartService.getCartItems(userId);
        const orderItems = cartItems.map(cartItem => ({
            title: cartItem.custom_text || cartItem.title || 'Кастомне замовлення'
        }));

        const result = await orderService.createOrder(userId, parsedDate, comment);
        
        if (result.success) {
            const confirmationText = Messages.formatOrderConfirmation(
                result.orderId, 
                parsedDate ? new Date(parsedDate).toLocaleDateString('uk-UA') : null, 
                comment
            );
            
            // Видаляємо попереднє повідомлення, якщо є
            if (message && message.message_id) {
                try {
                    await this.bot.deleteMessage(userId, message.message_id);
                } catch (error) {
                    // Ігноруємо помилки видалення
                }
            }
            
            // Відправляємо гіфку з текстом підтвердження
            // file_id отримано після завантаження mmm123123.gif через uploadGif.js
            const confirmationGifId = process.env.ORDER_CONFIRMATION_GIF_ID || 
                'CgACAgIAAxkDAAICoGkq7OzoQd4J9YJHO3sqYoGjYXqpAAIdjQAC2pJYSbm0X4NledjwNgQ';
            
            try {
                if (confirmationGifId) {
                    // Відправляємо гіфку з текстом
                    const sent = await this.bot.sendAnimation(userId, confirmationGifId, {
                        caption: confirmationText,
                        ...Keyboards.getMainMenu()
                    });
                    this.menuHandlers.userMessages.set(userId, sent.message_id);
                } else {
                    // Якщо гіфка не завантажена, відправляємо текст
                    const sent = await this.bot.sendMessage(userId, confirmationText, {
                        ...Keyboards.getMainMenu()
                    });
                    this.menuHandlers.userMessages.set(userId, sent.message_id);
                }
            } catch (error) {
                // Якщо не вдалося відправити гіфку, відправляємо текст
                const sent = await this.bot.sendMessage(userId, confirmationText, {
                    ...Keyboards.getMainMenu()
                });
                this.menuHandlers.userMessages.set(userId, sent.message_id);
            }

            // Відправляємо повідомлення партнеру
            if (isCoupleUser(userId)) {
                const partnerId = getPartnerId(userId);
                if (partnerId) {
                    try {
                        const notificationText = await Messages.formatOrderNotification(
                            userId,
                            orderItems,
                            parsedDate ? new Date(parsedDate).toLocaleDateString('uk-UA') : null,
                            comment
                        );
                        await this.bot.sendMessage(partnerId, notificationText, {
                            parse_mode: 'Markdown'
                        });
                    } catch (error) {
                        console.error('Помилка відправки повідомлення партнеру:', error);
                    }
                }
            }
        } else {
            if (message && message.message_id) {
                try {
                    await this.bot.editMessageText(result.message || 'Помилка оформлення замовлення', {
                        chat_id: userId,
                        message_id: message.message_id,
                        ...Keyboards.getMainMenu()
                    });
                } catch (error) {
                    await this.bot.sendMessage(userId, 
                        result.message || 'Помилка оформлення замовлення',
                        Keyboards.getMainMenu()
                    );
                }
            } else {
                await this.bot.sendMessage(userId, 
                    result.message || 'Помилка оформлення замовлення',
                    Keyboards.getMainMenu()
                );
            }
        }

        this.userStates.delete(userId);
        return true;
    }

    // Обробка введення коментаря
    async handleCommentInput(userId, text) {
        const state = this.userStates.get(userId);
        if (!state || !state.waitingForComment) {
            return false;
        }

        const dateRequested = state.dateRequested || null;
        const comment = text || null;

        // Отримуємо товари з кошика перед створенням замовлення (для повідомлення партнеру)
        const cartItems = await cartService.getCartItems(userId);
        const orderItems = cartItems.map(cartItem => ({
            title: cartItem.custom_text || cartItem.title || 'Кастомне замовлення'
        }));

        const result = await orderService.createOrder(userId, dateRequested, comment);
        
        const messageId = this.menuHandlers.userMessages.get(userId);
        const message = messageId ? { message_id: messageId } : null;
        
        if (result.success) {
            const confirmationText = Messages.formatOrderConfirmation(
                result.orderId, 
                dateRequested, 
                comment
            );
            
            if (message && message.message_id) {
                try {
                    await this.bot.editMessageText(confirmationText, {
                        chat_id: userId,
                        message_id: message.message_id,
                        ...Keyboards.getMainMenu(),
                        parse_mode: 'Markdown'
                    });
                    this.menuHandlers.userMessages.set(userId, message.message_id);
                } catch (error) {
                    const sent = await this.bot.sendMessage(userId, confirmationText, {
                        ...Keyboards.getMainMenu(),
                        parse_mode: 'Markdown'
                    });
                    this.menuHandlers.userMessages.set(userId, sent.message_id);
                }
            } else {
                const sent = await this.bot.sendMessage(userId, confirmationText, {
                    ...Keyboards.getMainMenu(),
                    parse_mode: 'Markdown'
                });
                this.menuHandlers.userMessages.set(userId, sent.message_id);
            }

            // Відправляємо повідомлення партнеру
            if (isCoupleUser(userId)) {
                const partnerId = getPartnerId(userId);
                if (partnerId) {
                    try {
                        const notificationText = await Messages.formatOrderNotification(
                            userId,
                            orderItems,
                            dateRequested,
                            comment
                        );
                        await this.bot.sendMessage(partnerId, notificationText, {
                            parse_mode: 'Markdown'
                        });
                    } catch (error) {
                        console.error('Помилка відправки повідомлення партнеру:', error);
                    }
                }
            }
        } else {
            if (message && message.message_id) {
                try {
                    await this.bot.editMessageText(result.message || 'Помилка оформлення замовлення', {
                        chat_id: userId,
                        message_id: message.message_id,
                        ...Keyboards.getMainMenu()
                    });
                } catch (error) {
                    await this.bot.sendMessage(userId, 
                        result.message || 'Помилка оформлення замовлення',
                        Keyboards.getMainMenu()
                    );
                }
            } else {
                await this.bot.sendMessage(userId, 
                    result.message || 'Помилка оформлення замовлення',
                    Keyboards.getMainMenu()
                );
            }
        }

        this.userStates.delete(userId);
        return true;
    }

    async handleOrderSpecialMenu(userId, queryId, message = null) {
        // Встановлюємо стан очікування коментаря для спецменю
        this.userStates.set(userId, { waitingForSpecialMenuComment: true });
        
        await safeAnswerCallbackQuery(this.bot, queryId);
        
        const requestText = 'Любимый 💕 Оставь комментарий к заказу, и не забудь добавить комплимент твоему шефу-Музе 💌';
        
        if (message && message.message_id) {
            try {
                await this.bot.editMessageText(requestText, {
                    chat_id: userId,
                    message_id: message.message_id,
                    ...Keyboards.getCancelKeyboard('cancel_special_menu_order')
                });
                return;
            } catch (error) {
                // Якщо не вдалося відредагувати, відправляємо нове
            }
        }
        
        const sent = await this.bot.sendMessage(userId, requestText, 
            Keyboards.getCancelKeyboard('cancel_special_menu_order')
        );
        this.menuHandlers.userMessages.set(userId, sent.message_id);
    }

    async handleSpecialMenuCommentInput(userId, text) {
        const state = this.userStates.get(userId);
        if (!state || !state.waitingForSpecialMenuComment) {
            return false;
        }

        const comment = text || null;
        const messageId = this.menuHandlers.userMessages.get(userId);
        const message = messageId ? { message_id: messageId } : null;

        // Відправляємо коментар адміну
        const adminHandlers = require('./adminHandlers');
        const adminIds = process.env.ADMIN_USER_ID || '';
        const adminUserIds = adminIds
            .split(',')
            .map(id => parseInt(id.trim()))
            .filter(id => !isNaN(id) && id > 0);
        
        const User = require('../models/User');
        const user = await User.findOne({ user_id: userId });
        const username = user ? (user.username ? `@${user.username}` : `ID: ${userId}`) : `ID: ${userId}`;
        
        // Екрануємо спеціальні символи Markdown для безпечного відображення
        const escapeMarkdown = (text) => {
            if (!text) return text;
            return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
        };
        
        const adminMessage = `📸 *Нове замовлення зі спецменю*\n\n` +
            `👤 Користувач: ${escapeMarkdown(username)}\n` +
            `💬 Коментар: ${escapeMarkdown(comment || '(без коментаря)')}`;
        
        for (const adminId of adminUserIds) {
            try {
                await this.bot.sendMessage(adminId, adminMessage, {
                    parse_mode: 'Markdown'
                });
            } catch (error) {
                console.error(`Помилка відправки повідомлення адміну ${adminId}:`, error);
                // Якщо Markdown не працює, спробуємо без форматування
                try {
                    const plainMessage = `📸 Нове замовлення зі спецменю\n\n` +
                        `👤 Користувач: ${username}\n` +
                        `💬 Коментар: ${comment || '(без коментаря)'}`;
                    await this.bot.sendMessage(adminId, plainMessage);
                } catch (error2) {
                    console.error(`Помилка відправки повідомлення адміну ${adminId} (без Markdown):`, error2);
                }
            }
        }

        // Відправляємо підтвердження користувачу з гіфкою
        const confirmationGifUrl = 'https://photos.google.com/album/AF1QipNOWoeOyEZMVHFkpFBBbJlv8xaAVOUUi8N2Y6fr/photo/AF1QipMw5QYOmVNnI5InRHCyBIMHjmhJ3wlNSApKbUjo';
        const confirmationText = 'Спасибо за заказ, лучший мужчина в мире!\n\nОплата при получении 💋\n\nХорошего вам дня 😘';
        
        // Видаляємо попереднє повідомлення, якщо є
        if (message && message.message_id) {
            try {
                await this.bot.deleteMessage(userId, message.message_id);
            } catch (error) {
                // Ігноруємо помилки видалення
            }
        }
        
        // Відправляємо гіфку з текстом підтвердження
        // Спочатку спробуємо через file_id з .env (якщо гіфка вже завантажена)
        const confirmationGifId = process.env.ORDER_CONFIRMATION_GIF_ID;
        let gifSent = false;
        
        if (confirmationGifId) {
            try {
                const sent = await this.bot.sendAnimation(userId, confirmationGifId, {
                    caption: confirmationText,
                    ...Keyboards.getMainMenu()
                });
                this.menuHandlers.userMessages.set(userId, sent.message_id);
                gifSent = true;
            } catch (error) {
                console.error('Помилка відправки гіфки через file_id:', error);
            }
        }
        
        // Якщо гіфка не відправлена, відправляємо текст з посиланням
        if (!gifSent) {
            const textWithLink = `${confirmationText}\n\n🎞️ [Гіфка](${confirmationGifUrl})`;
            try {
                const sent = await this.bot.sendMessage(userId, textWithLink, {
                    parse_mode: 'Markdown',
                    ...Keyboards.getMainMenu()
                });
                this.menuHandlers.userMessages.set(userId, sent.message_id);
            } catch (error) {
                // Якщо Markdown не працює, відправляємо без форматування
                const textWithLinkPlain = `${confirmationText}\n\n🎞️ Гіфка: ${confirmationGifUrl}`;
                const sent = await this.bot.sendMessage(userId, textWithLinkPlain, {
                    ...Keyboards.getMainMenu()
                });
                this.menuHandlers.userMessages.set(userId, sent.message_id);
            }
        }

        this.userStates.delete(userId);
        return true;
    }

    getUserState(userId) {
        return this.userStates.get(userId);
    }
}

module.exports = CallbackHandlers;
