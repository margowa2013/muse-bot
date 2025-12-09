const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    user_id: {
        type: Number,
        required: true,
        index: true
    },
    date_requested: Date,
    comment: String,
    status: {
        type: String,
        default: 'pending'
    },
    items: [{
        item_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Item'
        },
        custom_text: String,
        title: {
            type: String,
            required: true
        },
        price_amount: {
            type: Number,
            default: 0
        },
        currency_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Currency'
        }
    }]
}, {
    timestamps: true
});

module.exports = mongoose.model('Order', orderSchema);
