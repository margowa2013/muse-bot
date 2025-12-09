const mongoose = require('mongoose');
require('dotenv').config();
const { connectDB } = require('../config/database');

const Currency = require('../models/Currency');
const Category = require('../models/Category');
const Subcategory = require('../models/Subcategory');

async function initDatabase() {
    try {
        await connectDB();
        console.log('Ініціалізація бази даних...');

        // Додавання валют
        const currencies = [
            { name: 'Поцілунки', emoji: '💋' },
            { name: 'Обійми', emoji: '🤗' },
            { name: 'Масаж попи', emoji: '💆' },
            { name: 'Увага', emoji: '👀' },
            { name: 'Хвилиночки ніжності', emoji: '💕' }
        ];

        for (const currency of currencies) {
            await Currency.findOneAndUpdate(
                { name: currency.name },
                currency,
                { upsert: true, new: true }
            );
        }
        console.log('✅ Валюти додано');

        // Додавання категорій
        const categories = [
            { name: 'Їжа', emoji: '🍽️' },
            { name: 'Побачення', emoji: '🎬' },
            { name: 'Приємності', emoji: '💝' },
            { name: 'Коли на відстані', emoji: '📱' }
        ];

        const createdCategories = [];
        for (const category of categories) {
            const cat = await Category.findOneAndUpdate(
                { name: category.name },
                category,
                { upsert: true, new: true }
            );
            createdCategories.push(cat);
        }
        console.log('✅ Категорії додано');

        // Додавання підкатегорій
        const foodCategory = createdCategories.find(c => c.name === 'Їжа');
        const dateCategory = createdCategories.find(c => c.name === 'Побачення');
        const pleasuresCategory = createdCategories.find(c => c.name === 'Приємності');
        const distanceCategory = createdCategories.find(c => c.name === 'Коли на відстані');

        const subcategories = [
            // Їжа
            { category_id: foodCategory._id, name: 'Вибрати по фотографії' },
            // Побачення
            { category_id: dateCategory._id, name: 'Кінотеатр, але тільки останній ряд' },
            { category_id: dateCategory._id, name: 'Поїхали в сауну' },
            { category_id: dateCategory._id, name: 'Спільна пробіжка в ліс' },
            { category_id: dateCategory._id, name: 'Здивуй мене!' },
            // Приємності
            { category_id: pleasuresCategory._id, name: 'Почухати голову' },
            { category_id: pleasuresCategory._id, name: 'Масаж' },
            { category_id: pleasuresCategory._id, name: 'Грати в Call of Duty весь вечір' },
            { category_id: pleasuresCategory._id, name: 'Свій варіант', is_custom: true },
            // Коли на відстані
            { category_id: distanceCategory._id, name: 'А можна дзвінок у Facetime' },
            { category_id: distanceCategory._id, name: 'Ось би фотографію моєї дівчини' },
            { category_id: distanceCategory._id, name: 'Свій варіант', is_custom: true }
        ];

        for (const sub of subcategories) {
            await Subcategory.findOneAndUpdate(
                { category_id: sub.category_id, name: sub.name },
                sub,
                { upsert: true, new: true }
            );
        }
        console.log('✅ Підкатегорії додано');

        console.log('✅ Ініціалізація завершена!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Помилка ініціалізації:', error);
        process.exit(1);
    }
}

initDatabase();
