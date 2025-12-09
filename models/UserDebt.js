const mongoose = require('mongoose');

const userDebtSchema = new mongoose.Schema({
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
        default: 0
    }
}, {
    timestamps: true
});

// Унікальна комбінація user_id та currency_id
userDebtSchema.index({ user_id: 1, currency_id: 1 }, { unique: true });

module.exports = mongoose.model('UserDebt', userDebtSchema);
