const { CATEGORY_EMOJIS } = require('../config/constants');
const menuService = require('../services/menuService');

class Keyboards {
    // Головне меню (reply keyboard)
    static getMainMenu() {
        return {
            reply_markup: {
                keyboard: [
                    [{ text: `${CATEGORY_EMOJIS['Їжа']} Їжа` }, { text: `${CATEGORY_EMOJIS['Побачення']} Побачення` }],
                    [{ text: `${CATEGORY_EMOJIS['Приємності']} Приємності` }, { text: `${CATEGORY_EMOJIS['Коли на відстані']} Коли на відстані` }],
                    [{ text: `${CATEGORY_EMOJIS['Кошик']} Кошик` }, { text: `${CATEGORY_EMOJIS['Мій рахунок']} Мій рахунок` }]
                ],
                resize_keyboard: true,
                one_time_keyboard: false
            }
        };
    }


    // Підкатегорії
    static async getSubcategoriesKeyboard(categoryId) {
        const subcategories = await menuService.getSubcategories(categoryId);
        const buttons = subcategories.map(sub => [{ 
            text: sub.name, 
            callback_data: `subcategory_${sub._id.toString()}` 
        }]);
        buttons.push([{ text: '⬅️ Назад до меню', callback_data: 'back_to_menu' }]);
        
        return {
            reply_markup: {
                inline_keyboard: buttons
            }
        };
    }

    // Кнопки для товару (додати в кошик, перейти в кошик, назад)
    static getItemKeyboard(itemId, isRandomDate = false) {
        const buttons = [];
        
        if (isRandomDate) {
            // Для рандомних побачень - кнопка "крутити рулетку"
            buttons.push([{ text: '🎲 Крутити рулетку', callback_data: `spin_roulette_${itemId}` }]);
        } else {
            // Для звичайних товарів - кнопка "додати в кошик"
            buttons.push([{ text: '🛒 Додати в кошик', callback_data: `add_to_cart_${itemId}` }]);
        }
        
        buttons.push([{ text: '📦 Перейти в кошик', callback_data: 'show_cart' }]);
        buttons.push([{ text: '⬅️ Назад', callback_data: 'back_to_subcategory' }, { text: '🏠 До меню', callback_data: 'back_to_menu' }]);
        
        return {
            reply_markup: {
                inline_keyboard: buttons
            }
        };
    }
    
    // Кнопки для рандомного побачення після крутіння рулетки
    static getRandomDateKeyboard(itemId) {
        return {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🛒 Додати в кошик', callback_data: `add_to_cart_random_${itemId}` }],
                    [{ text: '🎲 Крутити ще раз', callback_data: `spin_roulette_${itemId}` }],
                    [{ text: '⬅️ Назад', callback_data: 'back_to_subcategory' }, { text: '🏠 До меню', callback_data: 'back_to_menu' }]
                ]
            }
        };
    }

    // Кнопки для галереї товарів
    static getGalleryKeyboard(currentIndex, totalItems, itemId) {
        const buttons = [];
        const navButtons = [];
        
        if (currentIndex > 0) {
            navButtons.push({ text: '⬅️', callback_data: `gallery_prev_${currentIndex - 1}` });
        }
        navButtons.push({ text: `${currentIndex + 1}/${totalItems}`, callback_data: 'gallery_info' });
        if (currentIndex < totalItems - 1) {
            navButtons.push({ text: '➡️', callback_data: `gallery_next_${currentIndex + 1}` });
        }
        
        buttons.push(navButtons);
        buttons.push([{ text: '🛒 Додати в кошик', callback_data: `add_to_cart_${itemId}` }]);
        buttons.push([{ text: '📦 Перейти в кошик', callback_data: 'show_cart' }]);
        buttons.push([{ text: '⬅️ Назад', callback_data: 'back_to_subcategory' }, { text: '🏠 До меню', callback_data: 'back_to_menu' }]);
        
        return {
            reply_markup: {
                inline_keyboard: buttons
            }
        };
    }

    // Кнопки для кошика
    static getCartKeyboard(cartItems) {
        const buttons = [];
        
        cartItems.forEach((item, index) => {
            const title = item.custom_text || item.title || 'Кастомне замовлення';
            const shortTitle = title.length > 30 ? title.substring(0, 30) + '...' : title;
            buttons.push([{ 
                text: `❤️ ${shortTitle}`, 
                callback_data: `remove_cart_${item.id.toString()}` 
            }]);
        });
        
        buttons.push([
            { text: '🗑️ Очистити кошик', callback_data: 'clear_cart' },
            { text: '✅ Оформити замовлення', callback_data: 'checkout' }
        ]);
        buttons.push([{ text: '⬅️ Назад до меню', callback_data: 'back_to_menu' }]);
        
        return {
            reply_markup: {
                inline_keyboard: buttons
            }
        };
    }

    // Кнопки для рахунку
    static getAccountKeyboard() {
        return {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '⬅️ Назад до меню', callback_data: 'back_to_menu' }]
                ]
            }
        };
    }

    // Кнопка "Назад до меню"
    static getBackToMenuKeyboard() {
        return {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '⬅️ Назад до меню', callback_data: 'back_to_menu' }]
                ]
            }
        };
    }

    // Кнопка "Скасувати" для форм
    static getCancelKeyboard(cancelCallback = 'cancel_form') {
        return {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '❌ Скасувати', callback_data: cancelCallback }]
                ]
            }
        };
    }

    // Кнопки для адмін-панелі
    static getAdminKeyboard() {
        return {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '📦 Додати товар', callback_data: 'admin_add_item' },
                        { text: '✏️ Редагувати товар', callback_data: 'admin_edit_item' }
                    ],
                    [
                        { text: '📋 Список замовлень', callback_data: 'admin_orders' },
                        { text: '💰 Відняти борг', callback_data: 'admin_pay_debt' }
                    ],
                    [
                        { text: '📸 Спецменю', callback_data: 'admin_special_menu' }
                    ],
                    [{ text: '⬅️ Звичайне меню', callback_data: 'back_to_menu' }]
                ]
            }
        };
    }

    // Кнопки для вибору категорії в адмін-панелі
    static getAdminCategoriesKeyboard(categories, callbackPrefix = 'admin_category_') {
        const buttons = categories.map(cat => [{ 
            text: `${cat.emoji} ${cat.name}`, 
            callback_data: `${callbackPrefix}${cat._id.toString()}` 
        }]);
        buttons.push([{ text: '❌ Скасувати', callback_data: 'admin_cancel' }]);
        
        return {
            reply_markup: {
                inline_keyboard: buttons
            }
        };
    }

    // Кнопки для вибору товару для редагування
    static getAdminItemsKeyboard(items) {
        const buttons = items.map(item => [{ 
            text: `${item.title}${item.photo_id ? ' 📷' : ' ❌'}`,
            callback_data: `admin_edit_item_${item._id.toString()}` 
        }]);
        buttons.push([{ text: '⬅️ Назад', callback_data: 'admin_back' }]);
        buttons.push([{ text: '❌ Скасувати', callback_data: 'admin_cancel' }]);
        
        return {
            reply_markup: {
                inline_keyboard: buttons
            }
        };
    }

    // Кнопки для вибору підкатегорії в адмін-панелі
    static getAdminSubcategoriesKeyboard(subcategories) {
        const buttons = subcategories.map(sub => [{ 
            text: sub.name, 
            callback_data: `admin_subcategory_${sub._id.toString()}` 
        }]);
        buttons.push([{ text: '⬅️ Назад', callback_data: 'admin_back' }]);
        buttons.push([{ text: '❌ Скасувати', callback_data: 'admin_cancel' }]);
        
        return {
            reply_markup: {
                inline_keyboard: buttons
            }
        };
    }

    // Кнопки для вибору валюти в адмін-панелі
    static getAdminCurrenciesKeyboard(currencies) {
        const buttons = currencies.map(c => [{ 
            text: `${c.emoji} ${c.name}`, 
            callback_data: `admin_currency_${c._id.toString()}` 
        }]);
        buttons.push([{ text: '❌ Скасувати', callback_data: 'admin_cancel' }]);
        
        return {
            reply_markup: {
                inline_keyboard: buttons
            }
        };
    }
}

module.exports = Keyboards;
