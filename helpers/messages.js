const cartService = require('../services/cartService');
const userService = require('../services/userService');

class Messages {
    // Форматування картки товару
    static formatItemCard(item) {
        let text = `*${item.title}*`;
        
        // Перевіряємо, чи опис не містить тільки "в подарунок" (щоб не дублювати)
        let shouldShowDescription = true;
        if (item.description) {
            const description = item.description.trim().toLowerCase();
            const price = item.price_amount !== undefined && item.price_amount !== null ? parseFloat(item.price_amount) : null;
            
            // Якщо ціна = 0 і опис містить тільки "в подарунок", не показуємо опис
            if (price === 0 && (
                description === 'в подарунок' ||
                description === 'в подарунок.' ||
                description === 'в подарунок!' ||
                description === 'в подарунок,'
            )) {
                shouldShowDescription = false;
            }
        }
        
        if (item.description && shouldShowDescription) {
            text += `\n${item.description}`;
        }
        
        // Для категорії "Побачення" не показуємо ціну
        const categoryName = item.category_id?.name || (item.category_id && typeof item.category_id === 'object' ? item.category_id.name : null);
        const shouldShowPrice = categoryName !== 'Побачення';
        
        if (shouldShowPrice && item.price_amount !== undefined && item.price_amount !== null) {
            const price = parseFloat(item.price_amount);
            if (price === 0) {
                text += `\n\n💋 Ціна: в подарунок`;
            } else if (item.currency_id) {
                const currencyName = item.currency_id.name || (typeof item.currency_id === 'string' ? item.currency_id : null);
                
                if (currencyName) {
                    // Форматування слова "поцілунок" залежно від числа
                    let currencyWord = currencyName.toLowerCase();
                    if (currencyName.toLowerCase().includes('поцілун')) {
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
                    
                    text += `\n\n💋 Ціна: ${price} ${currencyWord}`;
                }
            }
        }
        
        return text;
    }

    // Допоміжна функція для правильного множини "поцілунок"
    static getKissesWord(count) {
        const lastDigit = count % 10;
        const lastTwoDigits = count % 100;
        
        if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
            return 'поцілунків';
        } else if (lastDigit === 1) {
            return 'поцілунок';
        } else if (lastDigit >= 2 && lastDigit <= 4) {
            return 'поцілунки';
        } else {
            return 'поцілунків';
        }
    }

    // Форматування кошика
    static async formatCart(userId) {
        const items = await cartService.getCartItems(userId);
        const totals = await cartService.getCartTotal(userId);
        
        if (items.length === 0) {
            return '🛒 Ваш кошик порожній';
        }
        
        let text = '🛒 *Ваш кошик:*\n\n';
        
        items.forEach((item, index) => {
            const title = item.custom_text || item.title || 'Кастомне замовлення';
            let price = 'Безкоштовно';
            
            if (item.price_amount !== null && item.price_amount !== undefined) {
                const priceAmount = parseFloat(item.price_amount);
                if (priceAmount === 0) {
                    price = 'Безкоштовно';
                } else if (item.currency_name && item.currency_name.toLowerCase().includes('поцілун')) {
                    const kissesWord = this.getKissesWord(priceAmount);
                    price = `💋 Ціна: ${priceAmount} ${kissesWord}`;
                } else if (item.currency_name) {
                    price = `${item.currency_emoji || ''} ${item.price_amount} ${item.currency_name}`;
                } else {
                    price = `💋 Ціна: ${priceAmount} поцілунків`;
                }
            } else if (item.custom_text) {
                // Для кастомних товарів потрібно визначити ціну на основі категорії
                // Це буде оброблено в cartService при додаванні
                price = '💋 Ціна: вказується при додаванні';
            }
            
            text += `${index + 1}. ${title}\n   ${price}\n\n`;
        });
        
        if (totals.length > 0) {
            text += '*Загалом:*\n';
            totals.forEach(total => {
                if (total.currency_name && total.currency_name.toLowerCase().includes('поцілун')) {
                    const kissesWord = this.getKissesWord(total.amount);
                    text += `💋 ${total.amount} ${kissesWord}\n`;
                } else {
                    text += `${total.currency_emoji || ''} ${total.currency_name}: ${total.amount}\n`;
                }
            });
        }
        
        return text;
    }

    // Форматування рахунку
    static async formatAccount(userId) {
        const debts = await userService.getUserDebts(userId);
        
        let text = '*💳 Мій рахунок*\n\n';
        
        // Показуємо борги
        if (debts.length === 0) {
            text += '✅ У вас немає боргів! Ви вільні! 💕';
        } else {
            // Знаходимо борг за поцілунками
            const kissesDebt = debts.find(d => d.name.toLowerCase().includes('поцілун'));
            if (kissesDebt) {
                text += `Невиплачені поцілунки: ${kissesDebt.amount} 💋\n`;
            } else {
                // Якщо немає поцілунків, показуємо всі борги
                debts.forEach(debt => {
                    text += `${debt.emoji} ${debt.name}: ${debt.amount}\n`;
                });
            }
            text += '\nПоцілунки зависли в повітрі 😅\n\n';
            text += 'Пора надолужити відсутні прояви ніжності 😘\n\n';
            text += 'Муза чекає на оплату!';
        }
        
        return text;
    }

    // Форматування замовлення
    static formatOrderConfirmation(orderId, dateRequested, comment) {
        // Точний текст згідно з документацією
        let text = 'Спасибо за заказ, лучший мужчина в мире!\n\n';
        text += 'Оплата при получении.\n\n';
        text += 'Целуююю  😘';
        return text;
    }

    // Форматування повідомлення про замовлення для партнера
    static async formatOrderNotification(userId, orderItems, dateRequested, comment) {
        const userService = require('../services/userService');
        const user = await userService.getOrCreateUser(userId, null, null);
        const userName = user.first_name || 'Кохання';
        
        let text = `💌 *Нове замовлення від ${userName}!*\n\n`;
        
        text += '*Замовлення:*\n';
        orderItems.forEach((item, index) => {
            text += `${index + 1}. ${item.title}\n`;
        });
        
        text += `\n📅 *Дата:* ${dateRequested || 'Не вказано'}\n`;
        
        if (comment) {
            text += `💬 *Коментар:* ${comment}\n`;
        }
        
        text += '\n💕 Час виконувати побажання!';
        
        return text;
    }
}

module.exports = Messages;
