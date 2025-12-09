const mongoose = require('mongoose');

const paymentHistorySchema = new mongoose.Schema({
    user_id: {
        type: Number,
        required: true,
        index: true
    },
    currency_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Currency',
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    order_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('PaymentHistory', paymentHistorySchema);
