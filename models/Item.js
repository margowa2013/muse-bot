const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
    category_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
    subcategory_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subcategory'
    },
    title: {
        type: String,
        required: true
    },
    description: String,
    photo_id: String, // file_id для фото або гіфок
    video_id: String, // file_id для відео
    photo_url: String, // Тимчасове посилання для завантаження в Telegram
    media_type: String, // 'photo', 'gif', 'video'
    price_amount: {
        type: Number,
        default: 0
    },
    currency_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Currency'
    },
    is_active: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Item', itemSchema);
