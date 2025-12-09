/**
 * Helper функція для безпечної відповіді на callback query
 * Обробляє помилки про застарілі query
 */
async function safeAnswerCallbackQuery(bot, queryId, options = {}) {
    try {
        await bot.answerCallbackQuery(queryId, options);
    } catch (error) {
        // Ігноруємо помилки про застарілі query - це нормально
        if (error.response && error.response.body) {
            const errorBody = error.response.body;
            if (errorBody.error_code === 400 && 
                (errorBody.description && errorBody.description.includes('query is too old'))) {
                console.log('⚠️ Callback query застарів, ігноруємо:', queryId);
                return;
            }
        }
        // Логуємо інші помилки
        console.error('Помилка при відповіді на callback query:', error.message);
    }
}

module.exports = { safeAnswerCallbackQuery };

