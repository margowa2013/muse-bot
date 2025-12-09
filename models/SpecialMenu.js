const mongoose = require('mongoose');

const specialMenuSchema = new mongoose.Schema({
    photo_id: String,
    video_id: String,
    description: String,
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

module.exports = mongoose.model('SpecialMenu', specialMenuSchema);
