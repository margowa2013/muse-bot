const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
    user_id: {
        type: Number,
        required: true,
        index: true
    },
    item_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Item'
    },
    custom_text: String,
    price_amount: {
        type: Number,
        default: null
    },
    currency_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Currency'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('CartItem', cartItemSchema);
