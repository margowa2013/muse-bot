const mongoose = require('mongoose');
require('dotenv').config();
const { connectDB } = require('../config/database');

const Category = require('../models/Category');
const Subcategory = require('../models/Subcategory');
const Item = require('../models/Item');
const Currency = require('../models/Currency');

async function seedItems() {
    try {
        await connectDB();
        console.log('Додавання товарів до бази даних...');

        // Отримуємо категорії
        const foodCategory = await Category.findOne({ name: 'Їжа' });
        const dateCategory = await Category.findOne({ name: 'Побачення' });
        const pleasuresCategory = await Category.findOne({ name: 'Приємності' });
        const distanceCategory = await Category.findOne({ name: 'Коли на відстані' });

        if (!foodCategory || !dateCategory || !pleasuresCategory || !distanceCategory) {
            throw new Error('Не знайдено всі необхідні категорії. Запустіть спочатку database/init.js');
        }

        // Отримуємо або створюємо підкатегорії
        const foodSubcategory = await Subcategory.findOne({ 
            category_id: foodCategory._id, 
            name: 'Вибрати по фотографії' 
        });

        // Функція для отримання або створення підкатегорії
        const getOrCreateSubcategory = async (categoryId, targetName, alternativeNames = []) => {
            // Спочатку шукаємо за альтернативними назвами
            for (const altName of alternativeNames) {
                const found = await Subcategory.findOne({ category_id: categoryId, name: altName });
                if (found) {
                    // Оновлюємо назву на цільову
                    found.name = targetName;
                    await found.save();
                    return found;
                }
            }
            // Шукаємо за цільовою назвою
            let sub = await Subcategory.findOne({ category_id: categoryId, name: targetName });
            if (!sub) {
                // Створюємо нову
                sub = await Subcategory.create({ category_id: categoryId, name: targetName });
            }
            return sub;
        };

        // Підкатегорії для Побачення
        const dateSubcategories = {
            cinema: await getOrCreateSubcategory(
                dateCategory._id,
                'Кинотеатр, но только последний ряд',
                ['Кінотеатр, але тільки останній ряд']
            ),
            sauna: await getOrCreateSubcategory(
                dateCategory._id,
                'Поехали в сауну',
                ['Поїхали в сауну']
            ),
            run: await getOrCreateSubcategory(
                dateCategory._id,
                'Совместная пробежка',
                ['Спільна пробіжка в ліс']
            ),
            random: await getOrCreateSubcategory(
                dateCategory._id,
                'Рандомное для нас двоих'
            ),
            surprise: await getOrCreateSubcategory(
                dateCategory._id,
                'Удиви меня!',
                ['Здивуй мене!']
            )
        };

        // Підкатегорії для Приємності
        const pleasuresSubcategories = {
            scratch: await Subcategory.findOne({ 
                category_id: pleasuresCategory._id, 
                name: 'Почухати голову' 
            }),
            massage: await Subcategory.findOne({ 
                category_id: pleasuresCategory._id, 
                name: 'Масаж' 
            }),
            cod: await getOrCreateSubcategory(
                pleasuresCategory._id,
                'Играть в Call of Duty весь вечер',
                ['Грати в Call of Duty весь вечір']
            ),
            custom: await Subcategory.findOne({ 
                category_id: pleasuresCategory._id, 
                name: 'Свій варіант' 
            })
        };

        // Підкатегорії для Коли на відстані
        const distanceSubcategories = {
            facetime: await getOrCreateSubcategory(
                distanceCategory._id,
                'А можно звонок в Facetime',
                ['А можна дзвінок у Facetime']
            ),
            photo: await getOrCreateSubcategory(
                distanceCategory._id,
                'Вот бы фотографию моей девочки',
                ['Ось би фотографію моєї дівчини']
            ),
            custom: await Subcategory.findOne({ 
                category_id: distanceCategory._id, 
                name: 'Свій варіант' 
            })
        };

        // Отримуємо валюту
        const kissesCurrency = await Currency.findOne({ name: 'Поцілунки' });

        // Товари категорії "Їжа" з цінами, описами та посиланнями
        const foodItems = [
            { 
                title: 'Сирники, обійми і кава', 
                price: 3, 
                description: '', 
                photo_url: 'https://photos.app.goo.gl/xPL4D8vCBmBKq1Qq7' 
            },
            { 
                title: 'Яичница с лавашиком', 
                price: 2, 
                description: '', 
                photo_url: 'https://photos.app.goo.gl/xNaWEm3KryJb39mt9' 
            },
            { 
                title: 'Хочу твій омлет і твою усмішку', 
                price: 1, 
                description: '', 
                photo_url: 'https://photos.app.goo.gl/MEBRFLGzAbwZbLQ88' 
            },
            { 
                title: 'Может наконец-то попробуем супер овсянку', 
                price: 0, 
                description: 'в подарунок', 
                photo_url: 'https://photos.app.goo.gl/ohym7NTqMQBA8ttW6' 
            },
            { 
                title: 'Богатенький завтрак', 
                price: 3, 
                description: '', 
                photo_url: 'https://photos.app.goo.gl/Q4oa2r1in9e3pVeb6' 
            },
            { 
                title: 'Добавим побольше белка в завтрак', 
                price: 2, 
                description: '', 
                photo_url: 'https://photos.app.goo.gl/2u6n2H8QHWoQF62XA' 
            },
            { 
                title: 'Сніданок з беконом', 
                price: 2, 
                description: 'для серйозних намірів', 
                photo_url: 'https://photos.app.goo.gl/S3JRRkyrfmr2QWR17' 
            },
            { 
                title: 'От би твою гранолу з йогуртом і спокоєм', 
                price: 3, 
                description: '', 
                photo_url: 'https://photos.app.goo.gl/UfEsSYSio8odfSsA6' 
            },
            { 
                title: 'Блинчик — і тебе в нього загорнути', 
                price: 4, 
                description: '', 
                photo_url: 'https://photos.app.goo.gl/FTp6sinz42BDzodJ8' 
            },
            { 
                title: 'Пюре з курочкою', 
                price: 4, 
                description: 'смак дитинства і кохання', 
                photo_url: 'https://photos.app.goo.gl/1MHAebHPAH4QHsc29' 
            },
            { 
                title: 'Курочка, овочі й трохи любові', 
                price: 5, 
                description: '', 
                photo_url: 'https://photos.app.goo.gl/j5sW3XJA4ZChFFgc6' 
            },
            { 
                title: 'Сегодня в меню красная рыбка', 
                price: 2, 
                description: '', 
                photo_url: 'https://photos.app.goo.gl/wnPodyKGJkhFYrir8' 
            },
            { 
                title: 'Гречка й курочка', 
                price: 3, 
                description: 'дві прості причини бути щасливим', 
                photo_url: 'https://photos.app.goo.gl/zaWdcPXT924X3umU8' 
            },
            { 
                title: 'Пасту — з любов\'ю, як завжди', 
                price: 3, 
                description: '', 
                photo_url: 'https://photos.app.goo.gl/6GLNJTns1QxEEWg47' 
            },
            { 
                title: 'Ложку риса… или две', 
                price: 3, 
                description: 'чтобы наверняка', 
                photo_url: 'https://photos.app.goo.gl/RLXKvae8Jtirm9he6' 
            },
            { 
                title: 'Очень захотелось горячих бутербродов', 
                price: 2, 
                description: '', 
                photo_url: 'https://photos.app.goo.gl/xvmoCd5FngWXdDBy8' 
            },
            { 
                title: 'А может закажем суши??', 
                price: 1, 
                description: '', 
                photo_url: 'https://photos.app.goo.gl/kWrW8SCjJz6ArBwD9' 
            },
            { 
                title: 'Время побеждать кукурузу!', 
                price: 3, 
                description: '', 
                photo_url: 'https://photos.app.goo.gl/9b9to3PZuADW8FCKA' 
            },
            { 
                title: 'Порцию витаминов, пожалуйста', 
                price: 2, 
                description: '', 
                photo_url: 'https://photos.app.goo.gl/2EmywpC9kXGbBJ4F9' 
            },
            { 
                title: 'Вот бы мама торт сделала', 
                price: 8, 
                description: '', 
                photo_url: 'https://photos.app.goo.gl/iAASUDDH2SJG1zAo6' 
            }
        ];

        // Товари категорії "Побачення" (без ціни, з гіфками)
        const dateItems = [
            { 
                title: 'Кинотеатр, но только последний ряд 😏', 
                subcategory: dateSubcategories.cinema,
                description: '',
                photo_url: 'https://photos.app.goo.gl/GHbz8hKsFHhen6YZ7',
                price: 0,
                media_type: 'gif'
            },
            { 
                title: 'Поехали в сауну 🧖‍♀️', 
                subcategory: dateSubcategories.sauna,
                description: '',
                photo_url: 'https://photos.app.goo.gl/YN6Z5gWoxp8G4Sfv8',
                price: 0,
                media_type: 'gif'
            },
            { 
                title: 'Совместная пробежка 🌲', 
                subcategory: dateSubcategories.run,
                description: '',
                photo_url: 'https://photos.app.goo.gl/eaFdQPwvb2yBuTwA9',
                price: 0,
                media_type: 'photo'
            },
            { 
                title: 'Рандомное для нас двоих', 
                subcategory: dateSubcategories.random,
                description: '100 идей для свиданий 💕\n\nПри виборі цього варіанту ви отримаєте рандомну ідею для побачення!',
                photo_url: 'https://photos.app.goo.gl/VAZchbdKXt64b6LQ7',
                price: 0,
                media_type: 'gif'
            },
            { 
                title: 'Удиви меня!', 
                subcategory: dateSubcategories.surprise,
                description: '',
                photo_url: 'https://photos.app.goo.gl/y19aqA7Dgqem2MhH6',
                price: 0,
                media_type: 'gif'
            }
        ];

        // Товари категорії "Приємності"
        const pleasuresItems = [
            { 
                title: 'Почухати голову 💆🏽‍', 
                subcategory: pleasuresSubcategories.scratch,
                description: '',
                photo_url: 'https://photos.app.goo.gl/zVNbNg2SaRw54FSE6',
                price: 2,
                media_type: 'gif'
            },
            { 
                title: 'Массаж 😍', 
                subcategory: pleasuresSubcategories.massage,
                description: '',
                photo_url: 'https://photos.app.goo.gl/LZ4ttW1EtDpqyadv9',
                price: 5,
                media_type: 'gif'
            },
            { 
                title: 'Играть в Call of Duty весь вечер 🎮', 
                subcategory: pleasuresSubcategories.cod,
                description: '',
                photo_url: 'https://photos.app.goo.gl/2fUognRExTtdJBZRA',
                price: 3,
                media_type: 'video'
            },
            { 
                title: 'Свой вариант 📝', 
                subcategory: pleasuresSubcategories.custom,
                description: '',
                photo_url: 'https://photos.app.goo.gl/XQfSbV6W9u3x2LxF6',
                price: 6,
                media_type: 'gif'
            }
        ];

        // Товари категорії "Коли на відстані"
        const distanceItems = [
            { 
                title: 'А можно звонок в Facetime 🤳🏼', 
                subcategory: distanceSubcategories.facetime,
                description: '',
                photo_url: 'https://photos.app.goo.gl/AY88o5TqsrMJc6Tu9',
                price: 1,
                media_type: 'photo'
            },
            { 
                title: 'Вот бы фотографию моей девочки 👸🏽', 
                subcategory: distanceSubcategories.photo,
                description: '',
                photo_url: 'https://photos.app.goo.gl/vZFNHFfhshv3bvga7',
                price: 3,
                media_type: 'photo'
            },
            { 
                title: 'Свой вариант 📝', 
                subcategory: distanceSubcategories.custom,
                description: '',
                photo_url: 'https://photos.app.goo.gl/bdSwDwPKG2f7QMW1A',
                price: 3,
                media_type: 'gif'
            }
        ];

        // Додаємо товари категорії "Їжа"
        let addedCount = 0;
        for (const item of foodItems) {
            await Item.findOneAndUpdate(
                { category_id: foodCategory._id, title: item.title },
                {
                    category_id: foodCategory._id,
                    subcategory_id: foodSubcategory ? foodSubcategory._id : null,
                    title: item.title,
                    description: item.description,
                    photo_id: '', // Буде завантажено в Telegram пізніше
                    photo_url: item.photo_url, // Тимчасове посилання для завантаження
                    price_amount: item.price,
                    currency_id: item.price > 0 && kissesCurrency ? kissesCurrency._id : null,
                    media_type: 'photo', // Всі товари категорії "Їжа" - фото
                    is_active: true
                },
                { upsert: true, new: true }
            );
            addedCount++;
        }
        console.log(`✅ Додано ${addedCount} товарів категорії "Їжа"`);

        // Додаємо товари категорії "Побачення"
        addedCount = 0;
        for (const item of dateItems) {
            await Item.findOneAndUpdate(
                { category_id: dateCategory._id, title: item.title },
                {
                    category_id: dateCategory._id,
                    subcategory_id: item.subcategory ? item.subcategory._id : null,
                    title: item.title,
                    description: item.description,
                    photo_id: '', // Буде завантажено в Telegram пізніше
                    photo_url: item.photo_url, // Тимчасове посилання для завантаження
                    price_amount: item.price,
                    currency_id: null, // Без ціни для побачень
                    media_type: item.media_type || 'photo',
                    is_active: true
                },
                { upsert: true, new: true }
            );
            addedCount++;
        }
        console.log(`✅ Додано ${addedCount} товарів категорії "Побачення"`);

        // Додаємо товари категорії "Приємності"
        addedCount = 0;
        for (const item of pleasuresItems) {
            await Item.findOneAndUpdate(
                { category_id: pleasuresCategory._id, title: item.title },
                {
                    category_id: pleasuresCategory._id,
                    subcategory_id: item.subcategory ? item.subcategory._id : null,
                    title: item.title,
                    description: item.description,
                    photo_id: item.media_type === 'video' ? null : '', // Для відео використовуємо video_id
                    video_id: item.media_type === 'video' ? '' : null, // Для відео
                    photo_url: item.photo_url, // Тимчасове посилання для завантаження
                    price_amount: item.price,
                    currency_id: item.price > 0 && kissesCurrency ? kissesCurrency._id : null,
                    media_type: item.media_type || 'photo',
                    is_active: true
                },
                { upsert: true, new: true }
            );
            addedCount++;
        }
        console.log(`✅ Додано ${addedCount} товарів категорії "Приємності"`);

        // Додаємо товари категорії "Коли на відстані"
        addedCount = 0;
        for (const item of distanceItems) {
            await Item.findOneAndUpdate(
                { category_id: distanceCategory._id, title: item.title },
                {
                    category_id: distanceCategory._id,
                    subcategory_id: item.subcategory ? item.subcategory._id : null,
                    title: item.title,
                    description: item.description,
                    photo_id: '', // Буде завантажено в Telegram пізніше
                    photo_url: item.photo_url, // Тимчасове посилання для завантаження
                    price_amount: item.price,
                    currency_id: item.price > 0 && kissesCurrency ? kissesCurrency._id : null,
                    media_type: item.media_type || 'photo',
                    is_active: true
                },
                { upsert: true, new: true }
            );
            addedCount++;
        }
        console.log(`✅ Додано ${addedCount} товарів категорії "Коли на відстані"`);

        console.log('✅ Всі товари успішно додано!');
        console.log('\n📝 Наступні кроки:');
        console.log('   1. Завантажте медіафайли через адмін-панель (/admin → Додати/Редагувати товар)');
        console.log('   2. АБО використайте скрипт database/uploadMedia.js');
        console.log('   3. Детальні інструкції: database/MEDIA_UPLOAD_INSTRUCTIONS.md');
        console.log('\n💡 Для "Рандомное для нас двоих" - рандомна ідея генерується автоматично при додаванні в кошик');
        process.exit(0);
    } catch (error) {
        console.error('❌ Помилка додавання товарів:', error);
        process.exit(1);
    }
}

seedItems();

