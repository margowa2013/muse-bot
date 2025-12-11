const adminService = require('../services/adminService');
const userService = require('../services/userService');
const Keyboards = require('../helpers/keyboards');
const { safeAnswerCallbackQuery } = require('../helpers/callbackHelper');

class AdminHandlers {
    constructor(bot) {
        this.bot = bot;
        this.adminStates = new Map();
        this.adminMessages = new Map(); // Зберігаємо message_id для редагування
        
        // Підтримка кількох адмінів через кому в .env
        const adminIds = process.env.ADMIN_USER_ID || '';
        this.ADMIN_USER_IDS = adminIds
            .split(',')
            .map(id => parseInt(id.trim()))
            .filter(id => !isNaN(id) && id > 0);
        
        // Зворотна сумісність: якщо ADMIN_USER_ID встановлено як одне число
        if (this.ADMIN_USER_IDS.length === 0 && process.env.ADMIN_USER_ID) {
            const singleId = parseInt(process.env.ADMIN_USER_ID);
            if (!isNaN(singleId) && singleId > 0) {
                this.ADMIN_USER_IDS = [singleId];
            }
        }
    }

    isAdmin(userId) {
        return this.ADMIN_USER_IDS.includes(userId);
    }

    // Допоміжний метод для редагування або відправки повідомлення
    async editOrSendMessage(bot, userId, message, text, keyboard = null, useMarkdown = true) {
        try {
            if (message && message.message_id) {
                // Спробуємо відредагувати існуюче повідомлення
                try {
                    await bot.editMessageText(text, {
                        chat_id: userId,
                        message_id: message.message_id,
                        ...keyboard,
                        parse_mode: (keyboard && useMarkdown) ? 'Markdown' : undefined
                    });
                    this.adminMessages.set(userId, message.message_id);
                    return;
                } catch (error) {
                    // Якщо повідомлення містить медіа або не може бути відредаговане - видаляємо і надсилаємо нове
                    if (error.response && error.response.body && error.response.body.description) {
                        const errorDesc = error.response.body.description;
                        // Якщо помилка "message can't be edited" або повідомлення містить медіа
                        if (errorDesc.includes("can't be edited") || errorDesc.includes("message is not modified")) {
                            try {
                                // Видаляємо старе повідомлення
                                await bot.deleteMessage(userId, message.message_id);
                            } catch (deleteError) {
                                // Ігноруємо помилки видалення
                            }
                        } else if (errorDesc.includes('not modified')) {
                            // Якщо текст не змінився, просто виходимо
                            return;
                        }
                    }
                }
            }
            // Відправляємо нове повідомлення
            const sent = await bot.sendMessage(userId, text, {
                ...keyboard,
                parse_mode: (keyboard && useMarkdown) ? 'Markdown' : undefined
            });
            this.adminMessages.set(userId, sent.message_id);
        } catch (error) {
            console.error('Error in editOrSendMessage:', error);
            // Якщо помилка, відправляємо нове повідомлення
            const sent = await bot.sendMessage(userId, text, {
                ...keyboard,
                parse_mode: (keyboard && useMarkdown) ? 'Markdown' : undefined
            });
            this.adminMessages.set(userId, sent.message_id);
        }
    }

    // Допоміжний метод для редагування медіа
    async editOrSendMedia(bot, userId, message, mediaType, fileId, caption, keyboard = null) {
        try {
            if (message && message.message_id) {
                try {
                    if (mediaType === 'video') {
                        await bot.editMessageMedia({
                            type: 'video',
                            media: fileId,
                            caption: caption,
                            parse_mode: 'Markdown'
                        }, {
                            chat_id: userId,
                            message_id: message.message_id,
                            ...keyboard
                        });
                    } else if (mediaType === 'animation') {
                        await bot.editMessageMedia({
                            type: 'animation',
                            media: fileId,
                            caption: caption,
                            parse_mode: 'Markdown'
                        }, {
                            chat_id: userId,
                            message_id: message.message_id,
                            ...keyboard
                        });
                    } else {
                        await bot.editMessageMedia({
                            type: 'photo',
                            media: fileId,
                            caption: caption,
                            parse_mode: 'Markdown'
                        }, {
                            chat_id: userId,
                            message_id: message.message_id,
                            ...keyboard
                        });
                    }
                    return;
                } catch (error) {
                    // Якщо не вдалося відредагувати, видаляємо старе і надсилаємо нове
                    if (error.response && error.response.body && error.response.body.description) {
                        const errorDesc = error.response.body.description;
                        if (errorDesc.includes("can't be edited") || errorDesc.includes("not modified")) {
                            try {
                                // Видаляємо старе повідомлення
                                await bot.deleteMessage(userId, message.message_id);
                            } catch (deleteError) {
                                // Ігноруємо помилки видалення
                            }
                        }
                    }
                }
            }
            // Відправляємо нове повідомлення
            if (mediaType === 'video') {
                const sent = await bot.sendVideo(userId, fileId, {
                    caption: caption,
                    ...keyboard,
                    parse_mode: 'Markdown'
                });
                this.adminMessages.set(userId, sent.message_id);
            } else if (mediaType === 'animation') {
                const sent = await bot.sendAnimation(userId, fileId, {
                    caption: caption,
                    ...keyboard,
                    parse_mode: 'Markdown'
                });
                this.adminMessages.set(userId, sent.message_id);
            } else {
                const sent = await bot.sendPhoto(userId, fileId, {
                    caption: caption,
                    ...keyboard,
                    parse_mode: 'Markdown'
                });
                this.adminMessages.set(userId, sent.message_id);
            }
        } catch (error) {
            console.error('Error in editOrSendMedia:', error);
        }
    }

    async handleAdminCommand(bot, msg) {
        const userId = msg.from.id;
        
        if (!this.isAdmin(userId)) {
            return bot.sendMessage(userId, '❌ У вас немає доступу до адмін-панелі');
        }

        const text = msg.text;

        if (text === '📦 Додати товар') {
            await this.startAddItem(bot, userId);
        } else if (text === '✏️ Редагувати товар') {
            await this.startEditItem(bot, userId);
        } else if (text === '📋 Список замовлень') {
            await this.showOrders(bot, userId);
        } else if (text === '💰 Відняти борг') {
            await this.startPayDebt(bot, userId);
        } else if (text === '📸 Спецменю') {
            await this.startSpecialMenu(bot, userId);
        } else if (text === '⬅️ Звичайне меню') {
            this.adminStates.delete(userId);
            this.adminMessages.delete(userId);
            await bot.sendMessage(userId, 'Головне меню:', Keyboards.getMainMenu());
        }
    }

    async handleAdminCallback(bot, query) {
        const userId = query.from.id;
        const data = query.data;

        if (!this.isAdmin(userId)) {
            await safeAnswerCallbackQuery(bot, query.id, { text: '❌ У вас немає доступу' });
            return;
        }

        try {
            if (data === 'admin_add_item') {
                await this.startAddItem(bot, userId, query.message);
                await safeAnswerCallbackQuery(bot, query.id);
            } else if (data === 'admin_edit_item') {
                await this.startEditItem(bot, userId, query.message);
                await safeAnswerCallbackQuery(bot, query.id);
            } else if (data === 'admin_orders') {
                await this.showOrders(bot, userId, query.message);
                await safeAnswerCallbackQuery(bot, query.id);
            } else if (data.startsWith('admin_order_') && !data.startsWith('admin_order_pay_')) {
                const orderId = data.replace('admin_order_', '');
                await this.showOrderDetails(bot, userId, orderId, query.message);
                await safeAnswerCallbackQuery(bot, query.id);
            } else if (data.startsWith('admin_order_pay_')) {
                const targetUserId = parseInt(data.replace('admin_order_pay_', ''));
                await this.handleSelectUserForDebt(bot, userId, targetUserId, query.message);
                await safeAnswerCallbackQuery(bot, query.id);
            } else if (data === 'admin_pay_debt') {
                await this.startPayDebt(bot, userId, query.message);
                await safeAnswerCallbackQuery(bot, query.id);
            } else if (data.startsWith('admin_select_user_')) {
                const targetUserId = parseInt(data.replace('admin_select_user_', ''));
                await this.handleSelectUserForDebt(bot, userId, targetUserId, query.message);
                await safeAnswerCallbackQuery(bot, query.id);
            } else if (data === 'admin_special_menu') {
                await this.startSpecialMenu(bot, userId, query.message);
                await safeAnswerCallbackQuery(bot, query.id);
            } else if (data === 'admin_send_special_menu') {
                await this.sendSpecialMenu(bot, userId);
                await safeAnswerCallbackQuery(bot, query.id);
            } else if (data.startsWith('admin_special_menu_currency_')) {
                const currencyId = data.replace('admin_special_menu_currency_', '');
                await this.handleSpecialMenuCurrency(bot, userId, currencyId);
                await safeAnswerCallbackQuery(bot, query.id);
            } else if (data === 'admin_special_menu_no_price') {
                await this.handleSpecialMenuCurrency(bot, userId, 'no_price');
                await safeAnswerCallbackQuery(bot, query.id);
            } else if (data.startsWith('admin_category_')) {
                const categoryId = data.replace('admin_category_', '');
                await this.handleAddItemCategoryById(bot, userId, categoryId, query.message);
                await safeAnswerCallbackQuery(bot, query.id);
            } else if (data.startsWith('admin_subcategory_')) {
                const subcategoryId = data.replace('admin_subcategory_', '');
                await this.handleAddItemSubcategoryById(bot, userId, subcategoryId, query.message);
                await safeAnswerCallbackQuery(bot, query.id);
            } else if (data.startsWith('admin_currency_')) {
                const currencyId = data.replace('admin_currency_', '');
                await this.handleAddItemCurrencyById(bot, userId, currencyId, query.message);
                await safeAnswerCallbackQuery(bot, query.id);
            } else if (data.startsWith('admin_edit_category_')) {
                const categoryId = data.replace('admin_edit_category_', '');
                await this.handleEditItemCategoryById(bot, userId, categoryId, query.message);
                await safeAnswerCallbackQuery(bot, query.id);
            } else if (data.startsWith('admin_edit_item_')) {
                const itemId = data.replace('admin_edit_item_', '');
                await this.handleEditItemSelect(bot, userId, itemId, query.message);
                await safeAnswerCallbackQuery(bot, query.id);
            } else if (data.startsWith('admin_edit_photo_')) {
                const itemId = data.replace('admin_edit_photo_', '');
                await this.handleEditItemPhoto(bot, userId, itemId, query.message);
                await safeAnswerCallbackQuery(bot, query.id);
            } else if (data === 'admin_cancel') {
                this.adminStates.delete(userId);
                this.adminMessages.delete(userId);
                await this.editOrSendMessage(bot, userId, query.message, '❌ Скасовано', Keyboards.getAdminKeyboard());
                await safeAnswerCallbackQuery(bot, query.id);
            } else if (data === 'admin_back') {
                const state = this.adminStates.get(userId);
                if (state && state.categoryId) {
                    await this.startAddItem(bot, userId, query.message);
                } else if (state && state.step === 'edit_item_select') {
                    await this.startEditItem(bot, userId, query.message);
                } else {
                    await this.editOrSendMessage(bot, userId, query.message, '🔐 Адмін-панель', Keyboards.getAdminKeyboard());
                }
                await safeAnswerCallbackQuery(bot, query.id);
            }
        } catch (error) {
            console.error('Error handling admin callback:', error);
            await safeAnswerCallbackQuery(bot, query.id, { text: 'Помилка. Спробуйте ще раз.' });
        }
    }

    async startAddItem(bot, userId, message = null) {
        const categories = await adminService.getCategories();
        let text = '📦 *Додати товар*\n\nОберіть категорію:';
        
        const keyboard = Keyboards.getAdminCategoriesKeyboard(categories);

        await this.editOrSendMessage(bot, userId, message, text, keyboard);

        this.adminStates.set(userId, { step: 'add_item_category' });
    }

    async startEditItem(bot, userId, message = null) {
        const categories = await adminService.getCategories();
        let text = '✏️ *Редагувати товар*\n\nОберіть категорію:';
        
        const keyboard = Keyboards.getAdminCategoriesKeyboard(categories, 'admin_edit_category_');

        await this.editOrSendMessage(bot, userId, message, text, keyboard);

        this.adminStates.set(userId, { step: 'edit_item_category' });
    }

    async handleAddItemCategoryById(bot, userId, categoryId, message = null) {
        const mongoose = require('mongoose');
        if (!mongoose.Types.ObjectId.isValid(categoryId)) {
            return this.editOrSendMessage(bot, userId, message, '❌ Неправильний ID категорії');
        }

        const category = await adminService.getCategoryById(categoryId);
        if (!category) {
            return this.editOrSendMessage(bot, userId, message, '❌ Категорія не знайдена');
        }

        const subcategories = await adminService.getSubcategories(category._id);
        const keyboard = Keyboards.getAdminSubcategoriesKeyboard(subcategories);
        
        await this.editOrSendMessage(bot, userId, message, 'Оберіть підкатегорію:', keyboard);

        this.adminStates.set(userId, {
            step: 'add_item_subcategory',
            categoryId: category._id
        });
    }

    async handleEditItemCategoryById(bot, userId, categoryId, message = null) {
        const mongoose = require('mongoose');
        if (!mongoose.Types.ObjectId.isValid(categoryId)) {
            return this.editOrSendMessage(bot, userId, message, '❌ Неправильний ID категорії');
        }

        const category = await adminService.getCategoryById(categoryId);
        if (!category) {
            return this.editOrSendMessage(bot, userId, message, '❌ Категорія не знайдена');
        }

        const items = await adminService.getItemsByCategory(category._id);
        
        if (items.length === 0) {
            await this.editOrSendMessage(bot, userId, message, 
                `😔 Товарів у категорії "${category.name}" не знайдено`, 
                Keyboards.getAdminKeyboard());
            this.adminStates.delete(userId);
            return;
        }

        let text = `✏️ *Редагувати товар*\n\n*${category.emoji} ${category.name}*\n\nОберіть товар для редагування:`;
        const keyboard = Keyboards.getAdminItemsKeyboard(items);
        
        await this.editOrSendMessage(bot, userId, message, text, keyboard);

        this.adminStates.set(userId, {
            step: 'edit_item_select',
            categoryId: category._id
        });
    }

    async handleAddItemCategory(bot, userId, categoryName) {
        const categories = await adminService.getCategories();
        // Видаляємо емодзі з назви (якщо є) для пошуку
        const cleanCategoryName = categoryName.replace(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\s]+/u, '').trim();
        const category = categories.find(c => 
            c.name === categoryName || 
            c.name === cleanCategoryName ||
            categoryName.includes(c.name) ||
            `${c.emoji} ${c.name}` === categoryName
        );
        
        if (!category) {
            return bot.sendMessage(userId, 'Категорія не знайдена');
        }

        await this.handleAddItemCategoryById(bot, userId, category._id.toString());
    }

    async handleAddItemSubcategoryById(bot, userId, subcategoryId, message = null) {
        const mongoose = require('mongoose');
        const state = this.adminStates.get(userId);
        if (!state || state.step !== 'add_item_subcategory') return;

        if (!mongoose.Types.ObjectId.isValid(subcategoryId)) {
            return this.editOrSendMessage(bot, userId, message, '❌ Неправильний ID підкатегорії');
        }

        const subcategories = await adminService.getSubcategories(state.categoryId);
        const subcategory = subcategories.find(s => s._id.toString() === subcategoryId);
        
        if (!subcategory) {
            return this.editOrSendMessage(bot, userId, message, '❌ Підкатегорія не знайдена');
        }

        this.adminStates.set(userId, {
            step: 'add_item_title',
            categoryId: state.categoryId,
            subcategoryId: subcategory._id
        });

        await this.editOrSendMessage(bot, userId, message, '📝 Введіть назву товару:', Keyboards.getCancelKeyboard('admin_cancel'));
    }

    async handleEditItemSelect(bot, userId, itemId, message = null) {
        const mongoose = require('mongoose');
        if (!mongoose.Types.ObjectId.isValid(itemId)) {
            return this.editOrSendMessage(bot, userId, message, '❌ Неправильний ID товару');
        }

        const Item = require('../models/Item');
        const item = await Item.findById(itemId)
            .populate('category_id', 'name emoji')
            .populate('subcategory_id', 'name')
            .populate('currency_id', 'name emoji');

        if (!item) {
            return this.editOrSendMessage(bot, userId, message, '❌ Товар не знайдено');
        }

        let text = `✏️ *Редагувати товар*\n\n`;
        text += `*${item.title}*\n\n`;
        text += `Категорія: ${item.category_id.emoji} ${item.category_id.name}\n`;
        if (item.subcategory_id) {
            text += `Підкатегорія: ${item.subcategory_id.name}\n`;
        }
        text += `\nЩо хочете змінити?`;

        const keyboard = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📷 Додати/Змінити фото', callback_data: `admin_edit_photo_${itemId}` }],
                    [{ text: '⬅️ Назад', callback_data: 'admin_back' }],
                    [{ text: '❌ Скасувати', callback_data: 'admin_cancel' }]
                ]
            }
        };

        await this.editOrSendMessage(bot, userId, message, text, keyboard);

        this.adminStates.set(userId, {
            step: 'edit_item_photo',
            itemId: item._id
        });
    }

    async handleEditItemPhoto(bot, userId, itemId, message = null) {
        const mongoose = require('mongoose');
        if (!mongoose.Types.ObjectId.isValid(itemId)) {
            return this.editOrSendMessage(bot, userId, message, '❌ Неправильний ID товару');
        }

        const Item = require('../models/Item');
        const item = await Item.findById(itemId);

        if (!item) {
            return this.editOrSendMessage(bot, userId, message, '❌ Товар не знайдено');
        }

        await this.editOrSendMessage(bot, userId, message, 
            `📷 Надішліть фото/гіфку/відео для товару "${item.title}":\n\nАбо /skip щоб пропустити`, 
            Keyboards.getCancelKeyboard('admin_cancel'));

        this.adminStates.set(userId, {
            step: 'edit_item_photo_upload',
            itemId: item._id
        });
    }

    async handleAddItemSubcategory(bot, userId, subcategoryName) {
        const state = this.adminStates.get(userId);
        if (!state || state.step !== 'add_item_subcategory') return;

        const subcategories = await adminService.getSubcategories(state.categoryId);
        const subcategory = subcategories.find(s => s.name === subcategoryName);
        
        if (!subcategory) {
            return bot.sendMessage(userId, 'Підкатегорія не знайдена');
        }

        await this.handleAddItemSubcategoryById(bot, userId, subcategory._id.toString());
    }

    async handleAddItemData(bot, userId, text) {
        const state = this.adminStates.get(userId);
        if (!state) return;

        const message = this.adminMessages.get(userId) ? { message_id: this.adminMessages.get(userId) } : null;

        if (state.step === 'add_item_title') {
            this.adminStates.set(userId, {
                ...state,
                step: 'add_item_description',
                title: text
            });
            await this.editOrSendMessage(bot, userId, message, '📝 Введіть опис товару:', Keyboards.getCancelKeyboard('admin_cancel'));
        } else if (state.step === 'add_item_description') {
            this.adminStates.set(userId, {
                ...state,
                step: 'add_item_photo',
                description: text
            });
            await this.editOrSendMessage(bot, userId, message, '📸 Надішліть фото товару (або /skip щоб пропустити):', Keyboards.getCancelKeyboard('admin_cancel'));
        } else if (state.step === 'add_item_price') {
            const price = parseFloat(text);
            if (isNaN(price)) {
                return this.editOrSendMessage(bot, userId, message, '❌ Неправильна ціна. Введіть число:', Keyboards.getCancelKeyboard('admin_cancel'));
            }

            this.adminStates.set(userId, {
                ...state,
                step: 'add_item_currency',
                priceAmount: price
            });

            const currencies = await adminService.getCurrencies();
            const keyboard = Keyboards.getAdminCurrenciesKeyboard(currencies);

            await this.editOrSendMessage(bot, userId, message, '💱 Оберіть валюту:', keyboard);
        }
    }

    async handleAddItemPhoto(bot, userId, photoId, videoId, mediaType) {
        const state = this.adminStates.get(userId);
        if (!state || state.step !== 'add_item_photo') return;

        const message = this.adminMessages.get(userId) ? { message_id: this.adminMessages.get(userId) } : null;

        this.adminStates.set(userId, {
            ...state,
            step: 'add_item_price',
            photoId: photoId,
            videoId: videoId,
            mediaType: mediaType
        });

        await this.editOrSendMessage(bot, userId, message, '💰 Введіть ціну (число):', Keyboards.getCancelKeyboard('admin_cancel'));
    }

    async handleEditItemPhotoUpload(bot, userId, photoId, videoId, mediaType) {
        const state = this.adminStates.get(userId);
        if (!state || state.step !== 'edit_item_photo_upload' || !state.itemId) return;

        const Item = require('../models/Item');
        const item = await Item.findById(state.itemId);

        const messageId = this.adminMessages.get(userId);
        const message = messageId ? { message_id: messageId } : null;

        if (!item) {
            return this.editOrSendMessage(bot, userId, message, '❌ Товар не знайдено');
        }

        // Оновлюємо товар
        const updateData = {};
        if (mediaType === 'video') {
            updateData.video_id = videoId;
            updateData.photo_id = null;
            updateData.media_type = 'video';
        } else if (mediaType === 'gif') {
            updateData.photo_id = photoId;
            updateData.video_id = null;
            updateData.media_type = 'gif';
        } else if (mediaType === 'photo') {
            updateData.photo_id = photoId;
            updateData.video_id = null;
            updateData.media_type = 'photo';
        }

        await adminService.updateItem(
            state.itemId,
            item.title,
            item.description,
            updateData.photo_id,
            updateData.video_id,
            updateData.media_type,
            item.price_amount,
            item.currency_id
        );

        this.adminStates.delete(userId);
        this.adminMessages.delete(userId);

        await this.editOrSendMessage(bot, userId, message, 
            `✅ Фото для товару "${item.title}" успішно оновлено!`, 
            Keyboards.getAdminKeyboard());
    }

    async handleAddItemCurrencyById(bot, userId, currencyId, message = null) {
        const mongoose = require('mongoose');
        const state = this.adminStates.get(userId);
        if (!state || state.step !== 'add_item_currency') return;

        if (!mongoose.Types.ObjectId.isValid(currencyId)) {
            return this.editOrSendMessage(bot, userId, message, '❌ Неправильний ID валюти');
        }

        const currencies = await adminService.getCurrencies();
        const currency = currencies.find(c => c._id.toString() === currencyId);
        
        if (!currency) {
            return this.editOrSendMessage(bot, userId, message, '❌ Валюта не знайдена');
        }

        // Створюємо товар
        const item = await adminService.addItem(
            state.categoryId,
            state.subcategoryId,
            state.title,
            state.description,
            state.photoId || null,
            state.videoId || null,
            state.mediaType || 'photo',
            state.priceAmount,
            currency._id
        );

        this.adminStates.delete(userId);
        this.adminMessages.delete(userId);

        await this.editOrSendMessage(bot, userId, message, 
            `✅ Товар "${item.title}" успішно додано!`,
            Keyboards.getAdminKeyboard()
        );
    }

    async handleAddItemCurrency(bot, userId, currencyName) {
        const state = this.adminStates.get(userId);
        if (!state || state.step !== 'add_item_currency') return;

        const currencies = await adminService.getCurrencies();
        // Видаляємо емодзі з назви (якщо є) для пошуку
        const cleanCurrencyName = currencyName.replace(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\s]+/u, '').trim();
        const currency = currencies.find(c => 
            c.name === currencyName || 
            c.name === cleanCurrencyName ||
            currencyName.includes(c.name) ||
            `${c.emoji} ${c.name}` === currencyName
        );
        
        if (!currency) {
            return bot.sendMessage(userId, 'Валюта не знайдена');
        }

        await this.handleAddItemCurrencyById(bot, userId, currency._id.toString());
    }

    async showOrders(bot, userId, message = null) {
        const orders = await adminService.getAllOrders();
        
        if (orders.length === 0) {
            return this.editOrSendMessage(bot, userId, message, '📋 Замовлень поки немає', Keyboards.getAdminKeyboard());
        }

        let text = '📋 *Список замовлень:*\n\n';
        
        const buttons = [];
        orders.forEach((order, index) => {
            const userLabel = order.first_name || order.username
                ? `${order.first_name || ''} ${order.username ? '@' + order.username : ''}`.trim()
                : `ID: ${order.user_id || 'Невідомо'}`;
            text += `${index + 1}. Замовлення #${order.id}\n`;
            text += `   Користувач: ${userLabel}\n`;
            text += `   Дата: ${order.date_requested ? new Date(order.date_requested).toLocaleDateString('uk-UA') : 'Не вказано'}\n`;
            text += `   Позицій: ${order.items_count}\n`;
            text += `   Коментар: ${order.comment || '—'}\n`;
            text += `   Статус: ${order.status}\n\n`;

            buttons.push([{
                text: `🔍 #${order.id} (${order.items_count})`,
                callback_data: `admin_order_${order.id}`
            }]);
        });

        buttons.push([{ text: '⬅️ В адмін-меню', callback_data: 'admin_cancel' }]);

        const keyboard = {
            reply_markup: {
                inline_keyboard: buttons
            }
        };

        await this.editOrSendMessage(bot, userId, message, text, keyboard);
    }

    async showOrderDetails(bot, userId, orderId, message = null) {
        const details = await adminService.getOrderDetails(orderId);
        if (!details) {
            return this.editOrSendMessage(bot, userId, message, '❌ Замовлення не знайдено', Keyboards.getAdminKeyboard());
        }

        const { order, items } = details;
        const userLabel = order.first_name || order.username
            ? `${order.first_name || ''} ${order.username ? '@' + order.username : ''}`.trim()
            : `ID: ${order.user_id || 'Невідомо'}`;

        let text = `🧾 *Замовлення #${order.id}*\n`;
        text += `👤 Користувач: ${userLabel}\n`;
        text += `📅 Дата: ${order.date_requested ? new Date(order.date_requested).toLocaleDateString('uk-UA') : 'Не вказано'}\n`;
        text += `💬 Коментар: ${order.comment || '—'}\n`;
        text += `📌 Статус: ${order.status}\n`;
        text += `🧺 Позицій: ${items.length}\n\n`;

        if (items.length === 0) {
            text += '— Позиції відсутні\n';
        } else {
            items.forEach((it, idx) => {
                const pricePart = it.price_amount
                    ? `${it.price_amount} ${it.currency_emoji || ''} ${it.currency_name || ''}`.trim()
                    : '—';
                text += `${idx + 1}. ${it.title || it.custom_text || 'Без назви'}\n`;
                text += `   Ціна: ${pricePart}\n`;
                if (it.custom_text) {
                    text += `   Коментар до позиції: ${it.custom_text}\n`;
                }
            });
        }

        const buttons = [
            [{ text: '⬅️ До списку замовлень', callback_data: 'admin_orders' }],
        ];

        if (order.user_id) {
            buttons.unshift([{ text: '💰 Відняти борг', callback_data: `admin_order_pay_${order.user_id}` }]);
        }

        const keyboard = {
            reply_markup: {
                inline_keyboard: buttons
            }
        };

        await this.editOrSendMessage(bot, userId, message, text, keyboard);
    }

    async startPayDebt(bot, userId, message = null) {
        console.log('🔍 [DEBUG] Отримуємо список користувачів з боргами');
        
        const usersWithDebts = await userService.getUsersWithDebts();
        console.log('🔍 [DEBUG] Знайдено користувачів з боргами:', usersWithDebts.length);
        
        if (usersWithDebts.length === 0) {
            return this.editOrSendMessage(bot, userId, message, 
                '✅ Немає користувачів з боргами',
                Keyboards.getAdminKeyboard()
            );
        }
        
        // Формуємо список користувачів з боргами
        // Використовуємо звичайний текст без Markdown, щоб уникнути проблем з @
        let text = '👥 Користувачі з боргами:\n\n';
        const buttons = [];
        
        usersWithDebts.forEach((user, index) => {
            const displayName = user.first_name || user.username || `ID: ${user.user_id}`;
            const usernamePart = user.username ? `@${user.username}` : '';
            const totalDebt = user.total_debt.toFixed(1);
            
            // Екрануємо @ для безпеки (або просто не використовуємо Markdown)
            text += `${index + 1}. ${displayName} ${usernamePart}\n`;
            text += `   💳 Боргів: ${user.debts_count}, Загалом: ${totalDebt}\n\n`;
            
            // Створюємо кнопку для вибору користувача
            const buttonText = `${displayName} (${totalDebt})`;
            buttons.push([{ 
                text: buttonText.length > 50 ? buttonText.substring(0, 47) + '...' : buttonText, 
                callback_data: `admin_select_user_${user.user_id}` 
            }]);
        });
        
        buttons.push([{ text: '⬅️ Скасувати', callback_data: 'admin_cancel' }]);
        
        const keyboard = {
            reply_markup: {
                inline_keyboard: buttons
            }
        };
        
        this.adminStates.set(userId, { 
            step: 'pay_debt_user',
            usersWithDebts: usersWithDebts // Зберігаємо список для подальшого використання
        });
        
        // Відправляємо без Markdown, щоб уникнути проблем з @
        await this.editOrSendMessage(bot, userId, message, text, keyboard, false);
    }

    async handleSelectUserForDebt(bot, userId, targetUserId, message = null) {
        console.log('🔍 [DEBUG] Обробка вибору користувача для віднімання боргу');
        console.log('🔍 [DEBUG] targetUserId:', targetUserId);
        
        const state = this.adminStates.get(userId);
        if (!state) {
            console.error('❌ [ERROR] Стан адміна не знайдено');
            return;
        }
        
        // Отримуємо інформацію про користувача
        const User = require('../models/User');
        const user = await User.findOne({ user_id: targetUserId });
        
        if (!user) {
            console.error('❌ [ERROR] Користувача не знайдено');
            return this.editOrSendMessage(bot, userId, message, 
                '❌ Користувача не знайдено',
                Keyboards.getCancelKeyboard('admin_cancel')
            );
        }
        
        const username = user.username || user.first_name || `ID: ${targetUserId}`;
        console.log('🔍 [DEBUG] Шукаємо борги для user_id:', targetUserId);
        
        const debts = await userService.getUserDebts(targetUserId);
        console.log('🔍 [DEBUG] Знайдено боргів:', debts.length);
        console.log('🔍 [DEBUG] Борги:', JSON.stringify(debts, null, 2));
        
        if (debts.length === 0) {
            this.adminStates.delete(userId);
            this.adminMessages.delete(userId);
            return this.editOrSendMessage(bot, userId, message, 
                `✅ У користувача ${username} немає боргів`,
                Keyboards.getAdminKeyboard()
            );
        }

        let text = `💳 Борги користувача ${user.first_name || user.username || `ID: ${targetUserId}`}:\n\n`;
        debts.forEach((debt, index) => {
            text += `${index + 1}. ${debt.emoji} ${debt.name}: ${debt.amount}\n`;
            console.log(`🔍 [DEBUG] Борг ${index}:`, {
                emoji: debt.emoji,
                name: debt.name,
                amount: debt.amount,
                currency_id: debt.currency_id,
                currency_id_type: typeof debt.currency_id,
                currency_id_string: debt.currency_id?.toString()
            });
        });

        // Використовуємо індекс замість ObjectId для надійності
        const buttons = debts.map((debt, index) => {
            const callbackData = `admin_pay_${targetUserId}_${index}`;
            console.log(`🔍 [DEBUG] Створено кнопку ${index}:`, {
                text: `${debt.emoji} ${debt.name}`,
                callback_data: callbackData
            });
            return [{ text: `${debt.emoji} ${debt.name}`, callback_data: callbackData }];
        });
        buttons.push([{ text: '⬅️ Скасувати', callback_data: 'admin_cancel' }]);

        const keyboard = {
            reply_markup: {
                inline_keyboard: buttons
            }
        };

        await this.editOrSendMessage(bot, userId, message, text, keyboard);

        // Зберігаємо борги в стані для подальшого використання
        const stateToSave = {
            step: 'pay_debt_user', // Залишаємо pay_debt_user, щоб при виборі валюти можна було знайти debts
            targetUserId: targetUserId,
            username: username,
            debts: debts // Зберігаємо масив боргів
        };
        console.log('🔍 [DEBUG] Зберігаємо стан:', JSON.stringify(stateToSave, null, 2));
        
        this.adminStates.set(userId, stateToSave);
        console.log('✅ [SUCCESS] Стан збережено успішно');
    }

    async handlePayDebt(bot, userId, text) {
        const state = this.adminStates.get(userId);
        if (!state) return;

        const messageId = this.adminMessages.get(userId);
        const message = messageId ? { message_id: messageId } : null;

        // Обробка введення суми для віднімання боргу
        if (state.step === 'pay_debt_amount') {
            console.log('🔍 [DEBUG] Обробка введення суми для віднімання боргу');
            console.log('🔍 [DEBUG] Введений текст:', text);
            console.log('🔍 [DEBUG] Поточний стан:', JSON.stringify(state, null, 2));
            
            // Видаляємо всі нецифрові символи (крім крапки та коми для десяткових чисел)
            const cleanedText = text.replace(/[^\d.,]/g, '').replace(',', '.');
            const amount = parseFloat(cleanedText);
            
            console.log('🔍 [DEBUG] Очищений текст:', cleanedText);
            console.log('🔍 [DEBUG] Розпарсена сума:', amount);
            
            if (isNaN(amount) || amount <= 0) {
                console.error('❌ [ERROR] Невірна сума:', amount);
                return this.editOrSendMessage(bot, userId, message, 
                    '❌ Неправильна сума. Введіть тільки цифру (наприклад: 5 або 10.5)', 
                    Keyboards.getCancelKeyboard('admin_cancel')
                );
            }

            if (!state.currencyId) {
                console.error('❌ [ERROR] currencyId не вказано в стані');
                console.log('🔍 [DEBUG] Доступні ключі стану:', Object.keys(state));
                return this.editOrSendMessage(bot, userId, message, '❌ Помилка: не вказана валюта');
            }

            console.log('🔍 [DEBUG] Викликаємо payDebt з параметрами:');
            console.log('🔍 [DEBUG] - targetUserId:', state.targetUserId);
            console.log('🔍 [DEBUG] - currencyId:', state.currencyId);
            console.log('🔍 [DEBUG] - currencyId тип:', typeof state.currencyId);
            console.log('🔍 [DEBUG] - amount:', amount);

            const result = await userService.payDebt(state.targetUserId, state.currencyId, amount);
            
            console.log('🔍 [DEBUG] Результат payDebt:', JSON.stringify(result, null, 2));
            
            this.adminStates.delete(userId);
            this.adminMessages.delete(userId);
            
            if (result.success) {
                const username = state.username || 'користувача';
                // Відправляємо без Markdown, щоб уникнути проблем з @
                await this.editOrSendMessage(bot, userId, message, 
                    `✅ Борг віднято у @${username}!\nЗалишок: ${result.newAmount}`,
                    Keyboards.getAdminKeyboard(),
                    false // Вимикаємо Markdown
                );
            } else {
                await this.editOrSendMessage(bot, userId, message, result.message, Keyboards.getAdminKeyboard());
            }
        }
    }

    async startSpecialMenu(bot, userId, message = null) {
        this.adminStates.set(userId, { step: 'special_menu_photo' });
        await this.editOrSendMessage(bot, userId, message, '📸 Надішліть фото або відео для спецменю:', Keyboards.getCancelKeyboard('admin_cancel'));
    }

    async handleSpecialMenuMedia(bot, userId, photoId, videoId, msg = null) {
        const state = this.adminStates.get(userId);
        if (!state || state.step !== 'special_menu_photo') return;

        // Якщо це нове повідомлення з медіа, зберігаємо його message_id
        if (msg && msg.message_id) {
            this.adminMessages.set(userId, msg.message_id);
        }

        this.adminStates.set(userId, {
            ...state,
            step: 'special_menu_description',
            photoId: photoId,
            videoId: videoId
        });

        const message = this.adminMessages.get(userId) ? { message_id: this.adminMessages.get(userId) } : null;
        await this.editOrSendMessage(bot, userId, message, '📝 Введіть опис для спецменю:', Keyboards.getCancelKeyboard('admin_cancel'));
    }

    async handleSpecialMenuDescription(bot, userId, description) {
        const state = this.adminStates.get(userId);
        if (!state || state.step !== 'special_menu_description') return;

        // Зберігаємо опис в стані та переходимо до вибору вартості
        this.adminStates.set(userId, {
            ...state,
            step: 'special_menu_currency',
            description: description
        });
        
        const message = this.adminMessages.get(userId) ? { message_id: this.adminMessages.get(userId) } : null;
        
        // Знаходимо валюту "Поцілунки"
        const Currency = require('../models/Currency');
        const kissesCurrency = await Currency.findOne({ name: 'Поцілунки' });
        
        if (!kissesCurrency) {
            await this.editOrSendMessage(bot, userId, message, '❌ Помилка: валюта "Поцілунки" не знайдена в базі даних.', Keyboards.getCancelKeyboard('admin_cancel'));
            return;
        }
        
        // Показуємо тільки дві опції: Поцілунки або В подарунок
        const currencyKeyboard = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '💋 Поцілунки', callback_data: `admin_special_menu_currency_${kissesCurrency._id.toString()}` }],
                    [{ text: '🎁 В подарунок', callback_data: 'admin_special_menu_no_price' }],
                    [{ text: '❌ Скасувати', callback_data: 'admin_cancel' }]
                ]
            }
        };
        
        await this.editOrSendMessage(bot, userId, message, '💰 Виберіть вартість для спецменю:', currencyKeyboard);
    }

    async handleSpecialMenuCurrency(bot, userId, currencyId) {
        const state = this.adminStates.get(userId);
        if (!state || state.step !== 'special_menu_currency') return;

        if (currencyId === 'no_price') {
            // Без вартості - переходимо до підтвердження
            this.adminStates.set(userId, {
                ...state,
                step: 'special_menu_confirm',
                price_amount: 0,
                currency_id: null
            });
            
            const message = this.adminMessages.get(userId) ? { message_id: this.adminMessages.get(userId) } : null;
            await this.showSpecialMenuPreview(bot, userId, message);
        } else {
            // Зберігаємо валюту та переходимо до введення вартості
            this.adminStates.set(userId, {
                ...state,
                step: 'special_menu_price',
                currency_id: currencyId
            });
            
            const message = this.adminMessages.get(userId) ? { message_id: this.adminMessages.get(userId) } : null;
            await this.editOrSendMessage(bot, userId, message, '💰 Введіть вартість (тільки число):', Keyboards.getCancelKeyboard('admin_cancel'));
        }
    }

    async handleSpecialMenuPrice(bot, userId, priceText) {
        const state = this.adminStates.get(userId);
        if (!state || state.step !== 'special_menu_price') return;

        // Парсимо вартість
        const price = parseFloat(priceText.replace(/[^\d.,]/g, '').replace(',', '.'));
        
        if (isNaN(price) || price < 0) {
            const message = this.adminMessages.get(userId) ? { message_id: this.adminMessages.get(userId) } : null;
            await this.editOrSendMessage(bot, userId, message, '❌ Неправильна вартість. Введіть число:', Keyboards.getCancelKeyboard('admin_cancel'));
            return;
        }

        // Зберігаємо вартість та переходимо до підтвердження
        this.adminStates.set(userId, {
            ...state,
            step: 'special_menu_confirm',
            price_amount: price
        });
        
        const message = this.adminMessages.get(userId) ? { message_id: this.adminMessages.get(userId) } : null;
        await this.showSpecialMenuPreview(bot, userId, message);
    }

    async showSpecialMenuPreview(bot, userId, message = null) {
        const state = this.adminStates.get(userId);
        if (!state || state.step !== 'special_menu_confirm') return;

        let previewText = '📸 *Попередній перегляд спецменю:*\n\n';
        if (state.description) {
            previewText += `${state.description}\n\n`;
        }
        
        // Додаємо інформацію про вартість
        if (state.price_amount !== undefined && state.price_amount !== null && state.price_amount > 0 && state.currency_id) {
            const Currency = require('../models/Currency');
            const currency = await Currency.findById(state.currency_id);
            if (currency) {
                let currencyWord = currency.name.toLowerCase();
                if (currency.name.toLowerCase().includes('поцілун')) {
                    const price = state.price_amount;
                    const lastDigit = price % 10;
                    const lastTwoDigits = price % 100;
                    if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
                        currencyWord = 'поцілунків';
                    } else if (lastDigit === 1) {
                        currencyWord = 'поцілунок';
                    } else if (lastDigit >= 2 && lastDigit <= 4) {
                        currencyWord = 'поцілунки';
                    } else {
                        currencyWord = 'поцілунків';
                    }
                }
                previewText += `💋 Ціна: ${state.price_amount} ${currencyWord}\n\n`;
            }
        } else if (state.price_amount === 0 || !state.currency_id) {
            previewText += `💋 Ціна: в подарунок\n\n`;
        }
        
        previewText += 'Натисніть "Відправити", щоб надіслати всім користувачам.';
        
        const confirmKeyboard = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '✅ Відправити', callback_data: 'admin_send_special_menu' }],
                    [{ text: '❌ Скасувати', callback_data: 'admin_cancel' }]
                ]
            }
        };
        
        await this.editOrSendMessage(bot, userId, message, previewText, confirmKeyboard);
    }

    async sendSpecialMenu(bot, userId) {
        const state = this.adminStates.get(userId);
        if (!state || state.step !== 'special_menu_confirm') return;

        const specialMenu = await adminService.addSpecialMenu(
            state.photoId, 
            state.videoId, 
            state.description,
            state.price_amount || 0,
            state.currency_id || null
        );
        
        this.adminStates.delete(userId);
        const message = this.adminMessages.get(userId) ? { message_id: this.adminMessages.get(userId) } : null;
        this.adminMessages.delete(userId);
        
        // Відправляємо спецменю всім користувачам
        await this.sendSpecialMenuToAllUsers(bot, specialMenu);
        
        await this.editOrSendMessage(bot, userId, message, 
            '✅ Спецменю додано та відправлено всім користувачам!',
            Keyboards.getAdminKeyboard()
        );
    }

    async sendSpecialMenuToAllUsers(bot, specialMenu) {
        const User = require('../models/User');
        const Keyboards = require('../helpers/keyboards');
        const SpecialMenu = require('../models/SpecialMenu');
        
        try {
            // Перезавантажуємо спецменю з populate для отримання валюти
            const populatedMenu = await SpecialMenu.findById(specialMenu._id)
                .populate('currency_id', 'name emoji');
            
            // Отримуємо всіх активних користувачів
            const users = await User.find({});
            
            let specialText = '';
            if (populatedMenu.description) {
                specialText += `${populatedMenu.description}`;
            }
            
            // Додаємо інформацію про вартість
            if (populatedMenu.price_amount !== undefined && populatedMenu.price_amount !== null && populatedMenu.price_amount > 0 && populatedMenu.currency_id) {
                const currency = populatedMenu.currency_id;
                let currencyWord = currency.name.toLowerCase();
                if (currency.name.toLowerCase().includes('поцілун')) {
                    const price = populatedMenu.price_amount;
                    const lastDigit = price % 10;
                    const lastTwoDigits = price % 100;
                    if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
                        currencyWord = 'поцілунків';
                    } else if (lastDigit === 1) {
                        currencyWord = 'поцілунок';
                    } else if (lastDigit >= 2 && lastDigit <= 4) {
                        currencyWord = 'поцілунки';
                    } else {
                        currencyWord = 'поцілунків';
                    }
                }
                if (specialText) specialText += '\n\n';
                specialText += `💋 Ціна: ${populatedMenu.price_amount} ${currencyWord}`;
            } else if (populatedMenu.price_amount === 0 || !populatedMenu.currency_id) {
                if (specialText) specialText += '\n\n';
                specialText += `💋 Ціна: в подарунок`;
            }
            
            const specialMenuKeyboard = {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Оформити замовлення 💌', callback_data: 'order_special_menu' }]
                    ]
                }
            };
            
            let successCount = 0;
            let errorCount = 0;
            
            for (const user of users) {
                try {
                    if (populatedMenu.photo_id) {
                        await bot.sendPhoto(user.user_id, populatedMenu.photo_id, {
                            caption: specialText,
                            parse_mode: undefined,
                            ...specialMenuKeyboard
                        });
                    } else if (populatedMenu.video_id) {
                        await bot.sendVideo(user.user_id, populatedMenu.video_id, {
                            caption: specialText,
                            parse_mode: undefined,
                            ...specialMenuKeyboard
                        });
                    } else {
                        await bot.sendMessage(user.user_id, specialText || '🌟 Спецменю сьогодні', {
                            parse_mode: undefined,
                            ...specialMenuKeyboard
                        });
                    }
                    successCount++;
                } catch (error) {
                    console.error(`Помилка відправки спецменю користувачу ${user.user_id}:`, error);
                    errorCount++;
                }
            }
            
            console.log(`✅ Спецменю відправлено: ${successCount} успішно, ${errorCount} помилок`);
        } catch (error) {
            console.error('Помилка відправки спецменю всім користувачам:', error);
        }
    }

    getAdminState(userId) {
        return this.adminStates.get(userId);
    }

    setAdminState(userId, state) {
        this.adminStates.set(userId, state);
    }

    clearAdminState(userId) {
        this.adminStates.delete(userId);
    }
}

module.exports = AdminHandlers;
