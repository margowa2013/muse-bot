const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    user_id: {
        type: Number,
        required: true,
        unique: true,
        index: true
    },
    username: String,
    first_name: String,
    is_first_time: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('User', userSchema);
