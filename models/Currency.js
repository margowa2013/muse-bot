const mongoose = require('mongoose');

const currencySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    emoji: String
}, {
    timestamps: true
});

module.exports = mongoose.model('Currency', currencySchema);
