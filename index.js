const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

const { START_MESSAGE, FIRST_TIME_MESSAGE, GREETING_MESSAGES } = require('./config/constants');
const { connectDB } = require('./config/database');
const userService = require('./services/userService');
const menuService = require('./services/menuService');
const MenuHandlers = require('./handlers/menuHandlers');
const CallbackHandlers = require('./handlers/callbackHandlers');
const AdminHandlers = require('./handlers/adminHandlers');
const Keyboards = require('./helpers/keyboards');

// Підключення до MongoDB
connectDB();

// Ініціалізація бота
const token = process.env.BOT_TOKEN;
if (!token) {
    console.error('BOT_TOKEN не встановлено в .env файлі!');
    process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });
const { safeAnswerCallbackQuery } = require('./helpers/callbackHelper');

// Ініціалізація обробників
const menuHandlers = new MenuHandlers(bot);
const callbackHandlers = new CallbackHandlers(bot, menuHandlers);
const adminHandlers = new AdminHandlers(bot);

// Обробка команди /start
bot.onText(/\/start/, async (msg) => {
    const userId = msg.from.id;
    const username = msg.from.username;
    const firstName = msg.from.first_name;

    // Отримуємо або створюємо користувача
    const userData = await userService.getOrCreateUser(userId, username, firstName);
    const isFirstTime = userData.isFirstTime;

    // Завжди відправляємо перше повідомлення
    await bot.sendMessage(userId, FIRST_TIME_MESSAGE, Keyboards.getMainMenu());
    
    // Якщо це перший раз, позначаємо користувача як повернувся
    if (isFirstTime) {
        await userService.markUserAsReturning(userId);
    }
});

// Обробка команди /admin
bot.onText(/\/admin/, async (msg) => {
    const userId = msg.from.id;
    
    if (adminHandlers.isAdmin(userId)) {
        const sent = await bot.sendMessage(userId, '🔐 Адмін-панель', Keyboards.getAdminKeyboard());
        adminHandlers.adminMessages.set(userId, sent.message_id);
    } else {
        await bot.sendMessage(userId, '❌ У вас немає доступу до адмін-панелі');
    }
});

// Обробка кнопки START
bot.on('message', async (msg) => {
    const userId = msg.from.id;
    const text = msg.text;

    // Перевірка адмін-стану для обробки медіа
    const adminState = adminHandlers.getAdminState(userId);
    if (adminState && adminState.step === 'special_menu_photo') {
        // Зберігаємо message_id при отриманні медіа
        if (msg.message_id) {
            adminHandlers.adminMessages.set(userId, msg.message_id);
        }

        if (msg.photo) {
            const photoId = msg.photo[msg.photo.length - 1].file_id;
            await adminHandlers.handleSpecialMenuMedia(bot, userId, photoId, null, msg);
            return;
        } else if (msg.video) {
            const videoId = msg.video.file_id;
            await adminHandlers.handleSpecialMenuMedia(bot, userId, null, videoId, msg);
            return;
        }
    }

    if (adminState && (adminState.step === 'add_item_photo' || adminState.step === 'edit_item_photo_upload')) {
        // Зберігаємо message_id при отриманні медіа
        if (msg.message_id) {
            adminHandlers.adminMessages.set(userId, msg.message_id);
        }

        if (msg.photo) {
            const photoId = msg.photo[msg.photo.length - 1].file_id;
            if (adminState.step === 'edit_item_photo_upload') {
                await adminHandlers.handleEditItemPhotoUpload(bot, userId, photoId, null, 'photo');
            } else {
                await adminHandlers.handleAddItemPhoto(bot, userId, photoId, null, 'photo');
            }
            return;
        } else if (msg.video) {
            const videoId = msg.video.file_id;
            if (adminState.step === 'edit_item_photo_upload') {
                await adminHandlers.handleEditItemPhotoUpload(bot, userId, null, videoId, 'video');
            } else {
                await adminHandlers.handleAddItemPhoto(bot, userId, null, videoId, 'video');
            }
            return;
        } else if (msg.animation) {
            // Гіфка
            const gifId = msg.animation.file_id;
            if (adminState.step === 'edit_item_photo_upload') {
                await adminHandlers.handleEditItemPhotoUpload(bot, userId, gifId, null, 'gif');
            } else {
                await adminHandlers.handleAddItemPhoto(bot, userId, gifId, null, 'gif');
            }
            return;
        } else if (text === '/skip') {
            if (adminState.step === 'edit_item_photo_upload') {
                await adminHandlers.handleEditItemPhotoUpload(bot, userId, null, null, null);
            } else {
                await adminHandlers.handleAddItemPhoto(bot, userId, null, null, null);
            }
            return;
        }
    }

    // Перевіряємо, чи це текст (не команда)
    if (!text) {
        return;
    }


    // Обробка "Назад до меню" (для зворотної сумісності)
    if (text === '⬅️ Назад до меню' || text === '⬅️ Скасувати') {
        menuHandlers.clearUserState(userId);
        callbackHandlers.userStates.delete(userId);
        adminHandlers.clearAdminState(userId);
        await bot.sendMessage(userId, 'Головне меню:', Keyboards.getMainMenu());
        return;
    }

    // Обробка адмін-команд (для зворотної сумісності)
    if (adminHandlers.isAdmin(userId)) {
        const adminState = adminHandlers.getAdminState(userId);
        
        // Адмін-кнопки (текстові команди)
        if (text.startsWith('📦') || text.startsWith('📋') || text.startsWith('💰') || text.startsWith('📸') || text === '⬅️ Звичайне меню') {
            await adminHandlers.handleAdminCommand(bot, msg);
            return;
        }

        // Обробка станів адміна
        if (adminState) {
            if (adminState.step === 'add_item_category') {
                await adminHandlers.handleAddItemCategory(bot, userId, text);
                return;
            } else if (adminState.step === 'add_item_subcategory') {
                await adminHandlers.handleAddItemSubcategory(bot, userId, text);
                return;
            } else if (adminState.step === 'add_item_title' || adminState.step === 'add_item_description' || adminState.step === 'add_item_price') {
                await adminHandlers.handleAddItemData(bot, userId, text);
                return;
            } else if (adminState.step === 'add_item_currency') {
                await adminHandlers.handleAddItemCurrency(bot, userId, text);
                return;
            } else if (adminState.step === 'special_menu_description') {
                await adminHandlers.handleSpecialMenuDescription(bot, userId, text);
                return;
            } else if (adminState.step === 'special_menu_price') {
                await adminHandlers.handleSpecialMenuPrice(bot, userId, text);
                return;
            } else if (adminState.step === 'pay_debt_user' || adminState.step === 'pay_debt_amount') {
                await adminHandlers.handlePayDebt(bot, userId, text);
                return;
            }
        }
    }

    // Перевірка стану користувача для оформлення замовлення
    const callbackState = callbackHandlers.getUserState(userId);
    if (callbackState) {
        if (callbackState.waitingForDate) {
            const handled = await callbackHandlers.handleDateInput(userId, text);
            if (handled) return;
        } else if (callbackState.waitingForComment) {
            const handled = await callbackHandlers.handleCommentInput(userId, text);
            if (handled) return;
        } else if (callbackState.waitingForSpecialMenuComment) {
            const handled = await callbackHandlers.handleSpecialMenuCommentInput(userId, text);
            if (handled) return;
        }
    }

    // Обробка reply keyboard кнопок - точне порівняння, щоб не обробляти як текст
    const categories = await menuService.getCategories();
    const { CATEGORY_EMOJIS } = require('./config/constants');
    
    // Створюємо список точних текстів кнопок reply keyboard
    const replyKeyboardTexts = [];
    
    // Додаємо тексти категорій
    for (const category of categories) {
        const emoji = category.emoji || CATEGORY_EMOJIS[category.name] || '';
        const fullText = emoji ? `${emoji} ${category.name}` : category.name;
        replyKeyboardTexts.push(fullText);
        replyKeyboardTexts.push(category.name); // Також додаємо без емодзі для сумісності
    }
    
    // Додаємо тексти спеціальних кнопок
    replyKeyboardTexts.push(`${CATEGORY_EMOJIS['Кошик']} Кошик`);
    replyKeyboardTexts.push('Кошик');
    replyKeyboardTexts.push(`${CATEGORY_EMOJIS['Мій рахунок']} Мій рахунок`);
    replyKeyboardTexts.push('Мій рахунок');
    
    // Перевіряємо, чи це кнопка reply keyboard (точне співпадіння)
    const isReplyKeyboardButton = replyKeyboardTexts.includes(text);
    
    if (isReplyKeyboardButton) {
        // Очищаємо стан очікування кастомного тексту
        const menuState = menuHandlers.getUserState(userId);
        if (menuState && menuState.waitingForCustomText) {
            menuHandlers.clearUserState(userId);
        }
        
        // Обробка кошика
        if (text === `${CATEGORY_EMOJIS['Кошик']} Кошик` || text === 'Кошик') {
            await menuHandlers.handleCart(bot, msg);
            return;
        }
        
        // Обробка рахунку
        if (text === `${CATEGORY_EMOJIS['Мій рахунок']} Мій рахунок` || text === 'Мій рахунок') {
            await menuHandlers.handleAccount(bot, msg);
            return;
        }
        
        // Обробка категорій меню
        for (const category of categories) {
            const emoji = category.emoji || CATEGORY_EMOJIS[category.name] || '';
            const fullText = emoji ? `${emoji} ${category.name}` : category.name;
            
            if (text === fullText || text === category.name) {
                await menuHandlers.handleCategory(bot, msg, category.name);
                return;
            }
        }
    }

    // Обробка підкатегорій (для зворотної сумісності) - перевіряємо ПЕРЕД обробкою кастомного тексту
    const allSubcategories = [];
    for (const category of categories) {
        const subs = await menuService.getSubcategories(category._id);
        allSubcategories.push(...subs.map(s => s.name));
    }
    
    if (allSubcategories.includes(text)) {
        // Очищаємо стан очікування кастомного тексту перед переходом до підкатегорії
        const menuState = menuHandlers.getUserState(userId);
        if (menuState && menuState.waitingForCustomText) {
            menuHandlers.clearUserState(userId);
        }
        await menuHandlers.handleSubcategory(bot, msg, text);
        return;
    }

    // Перевірка стану для кастомного тексту - тільки після перевірки всіх кнопок меню
    const menuState = menuHandlers.getUserState(userId);
    if (menuState && menuState.waitingForCustomText) {
        await menuHandlers.handleCustomText(bot, msg);
        return;
    }
});

// Обробка callback-запитів
bot.on('callback_query', async (query) => {
    const userId = query.from.id;
    const data = query.data;
    
    try {
        // Обробка категорій меню
        if (data.startsWith('category_')) {
            // Очищаємо стан очікування кастомного тексту перед переходом до категорії
            const menuState = menuHandlers.getUserState(userId);
            if (menuState && menuState.waitingForCustomText) {
                menuHandlers.clearUserState(userId);
            }
            
            const categoryName = data.replace('category_', '');
            await safeAnswerCallbackQuery(bot, query.id);
            await menuHandlers.handleCategory(bot, { from: query.from }, categoryName, query.message);
            return;
        }

        // Обробка підкатегорій
        if (data.startsWith('subcategory_')) {
            // Очищаємо стан очікування кастомного тексту перед переходом до підкатегорії
            const menuState = menuHandlers.getUserState(userId);
            if (menuState && menuState.waitingForCustomText) {
                menuHandlers.clearUserState(userId);
            }
            
            const mongoose = require('mongoose');
            const Subcategory = require('./models/Subcategory');
            const subcategoryId = data.replace('subcategory_', '');
            if (mongoose.Types.ObjectId.isValid(subcategoryId)) {
                const sub = await Subcategory.findById(subcategoryId).populate('category_id');
                if (sub) {
                    // Зберігаємо categoryId в стані перед обробкою підкатегорії
                    const menuState = menuHandlers.getUserState(userId) || {};
                    menuState.categoryId = sub.category_id._id;
                    menuHandlers.setUserState(userId, menuState);
                    
                    await safeAnswerCallbackQuery(bot, query.id);
                    await menuHandlers.handleSubcategory(bot, { from: query.from }, sub.name, query.message);
                    return;
                }
            }
        }

        // Обробка кошика та рахунку
        if (data === 'show_cart') {
            // Очищаємо стан очікування кастомного тексту при переході в кошик
            const menuState = menuHandlers.getUserState(userId);
            if (menuState && menuState.waitingForCustomText) {
                menuHandlers.clearUserState(userId);
            }
            await safeAnswerCallbackQuery(bot, query.id);
            await menuHandlers.handleCart(bot, { from: query.from }, query.message);
            return;
        }

        if (data === 'show_account') {
            await safeAnswerCallbackQuery(bot, query.id);
            await menuHandlers.handleAccount(bot, { from: query.from }, query.message);
            return;
        }

        // Обробка адмін callback-ів
        if (adminHandlers.isAdmin(userId) && data.startsWith('admin_')) {
            // Перевіряємо, чи це вибір валюти для віднімання боргу (admin_pay_USERID_INDEX)
            // Але НЕ admin_pay_debt (це кнопка початку процесу)
            if (data.startsWith('admin_pay_') && data !== 'admin_pay_debt') {
                console.log('🔍 [DEBUG] Обробка admin_pay callback (вибір валюти)');
                console.log('🔍 [DEBUG] Callback data:', data);
                
                const parts = data.split('_');
                console.log('🔍 [DEBUG] Розбиття callback_data:', parts);
                
                // Формат: admin_pay_USERID_INDEX
                if (parts.length < 4) {
                    console.error('❌ [ERROR] Невірний формат callback_data:', data);
                    await safeAnswerCallbackQuery(bot, query.id, { text: '❌ Помилка: невірний формат' });
                    return;
                }
                
                const targetUserId = parseInt(parts[2]);
                const debtIndex = parseInt(parts[3]);
                
                console.log('🔍 [DEBUG] targetUserId:', targetUserId);
                console.log('🔍 [DEBUG] debtIndex:', debtIndex);
                
                if (isNaN(targetUserId) || isNaN(debtIndex)) {
                    console.error('❌ [ERROR] Невірні параметри:', { targetUserId, debtIndex });
                    await safeAnswerCallbackQuery(bot, query.id, { text: '❌ Помилка: невірні параметри' });
                    return;
                }
                
                // Отримуємо поточний стан адміна
                const currentState = adminHandlers.getAdminState(userId);
                console.log('🔍 [DEBUG] Поточний стан адміна:', JSON.stringify(currentState, null, 2));
                
                if (!currentState) {
                    console.error('❌ [ERROR] Стан адміна не знайдено');
                    await safeAnswerCallbackQuery(bot, query.id, { text: '❌ Помилка: стан не знайдено. Спробуйте знову.' });
                    return;
                }
                
                if (!currentState.debts) {
                    console.error('❌ [ERROR] Масив debts не знайдено в стані');
                    console.log('🔍 [DEBUG] Доступні ключі стану:', Object.keys(currentState));
                    await safeAnswerCallbackQuery(bot, query.id, { text: '❌ Помилка: не знайдено борги. Спробуйте знову вибрати користувача.' });
                    return;
                }
                
                console.log('🔍 [DEBUG] Кількість боргів у масиві:', currentState.debts.length);
                console.log('🔍 [DEBUG] Всі борги:', JSON.stringify(currentState.debts, null, 2));
                
                if (debtIndex < 0 || debtIndex >= currentState.debts.length) {
                    console.error('❌ [ERROR] Невірний індекс боргу:', debtIndex, 'з', currentState.debts.length);
                    await safeAnswerCallbackQuery(bot, query.id, { text: `❌ Помилка: невірний індекс боргу (${debtIndex})` });
                    return;
                }
                
                // Отримуємо валюту зі збереженого масиву боргів
                const selectedDebt = currentState.debts[debtIndex];
                console.log('🔍 [DEBUG] Вибраний борг:', JSON.stringify(selectedDebt, null, 2));
                
                if (!selectedDebt || !selectedDebt.currency_id) {
                    console.error('❌ [ERROR] Вибраний борг не містить currency_id');
                    await safeAnswerCallbackQuery(bot, query.id, { text: '❌ Помилка: не знайдено валюту в боргу' });
                    return;
                }
                
                const currencyId = selectedDebt.currency_id;
                console.log('🔍 [DEBUG] currencyId:', currencyId);
                console.log('🔍 [DEBUG] Тип currencyId:', typeof currencyId);
                
                await safeAnswerCallbackQuery(bot, query.id);
                
                const messageId = adminHandlers.adminMessages.get(userId);
                const message = messageId ? { message_id: messageId } : null;
                
                const sent = await bot.sendMessage(userId, `💰 Введіть суму для віднімання боргу (тільки цифру, без валюти):`, Keyboards.getCancelKeyboard('admin_cancel'));
                adminHandlers.adminMessages.set(userId, sent.message_id);
                
                // Оновлюємо стан з вибраною валютою, зберігаючи debts
                const newState = {
                    step: 'pay_debt_amount',
                    targetUserId: targetUserId,
                    currencyId: currencyId,
                    username: currentState.username,
                    debts: currentState.debts // Зберігаємо debts для майбутнього використання
                };
                console.log('🔍 [DEBUG] Новий стан:', JSON.stringify(newState, null, 2));
                
                adminHandlers.setAdminState(userId, newState);
                console.log('✅ [SUCCESS] Стан оновлено успішно');
                return;
            } else {
                // Обробка інших адмін callback-ів (включаючи admin_pay_debt)
                await adminHandlers.handleAdminCallback(bot, query);
                return;
            }
        }
        
        // Обробка скасування форм
        if (data === 'cancel_form' || data === 'cancel_order' || data === 'cancel_special_menu_order' || data === 'admin_cancel') {
            await safeAnswerCallbackQuery(bot, query.id);
            const adminState = adminHandlers.getAdminState(userId);
            if (adminState) {
                adminHandlers.clearAdminState(userId);
                adminHandlers.adminMessages.delete(userId);
                await bot.sendMessage(userId, '❌ Скасовано', Keyboards.getAdminKeyboard());
            } else {
                menuHandlers.clearUserState(userId);
                callbackHandlers.userStates.delete(userId);
                menuHandlers.userMessages.delete(userId);
                await callbackHandlers.handleBackToMenu(userId, query.message);
            }
            return;
        }
        
        await callbackHandlers.handleCallback(query);
    } catch (error) {
        console.error('Error handling callback:', error);
        await safeAnswerCallbackQuery(bot, query.id, { text: 'Помилка. Спробуйте ще раз.' });
    }
});

// Обробка помилок
bot.on('polling_error', (error) => {
    console.error('Polling error:', error);
});

// Обробка помилок бота
bot.on('error', (error) => {
    console.error('Bot error:', error);
});

console.log('🤖 MuseBot запущено!');
console.log('Бот готовий до роботи 💕');

// Graceful shutdown
process.once('SIGINT', () => {
    console.log('\n⏹️  Зупинка бота...');
    bot.stopPolling();
    process.exit(0);
});

process.once('SIGTERM', () => {
    console.log('\n⏹️  Зупинка бота...');
    bot.stopPolling();
    process.exit(0);
});
