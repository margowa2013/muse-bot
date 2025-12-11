const Item = require('../models/Item');
const Order = require('../models/Order');
const User = require('../models/User');
const Currency = require('../models/Currency');
const Category = require('../models/Category');
const Subcategory = require('../models/Subcategory');
const SpecialMenu = require('../models/SpecialMenu');

class AdminService {
    async addItem(categoryId, subcategoryId, title, description, photoId, videoId, mediaType, priceAmount, currencyId) {
        const item = await Item.create({
            category_id: categoryId,
            subcategory_id: subcategoryId,
            title: title,
            description: description,
            photo_id: photoId || null,
            video_id: videoId || null,
            media_type: mediaType || 'photo',
            price_amount: priceAmount,
            currency_id: currencyId,
            is_active: true
        });
        return item;
    }

    async updateItem(itemId, title, description, photoId, videoId, mediaType, priceAmount, currencyId) {
        const updateData = {
            title: title,
            description: description,
            price_amount: priceAmount,
            currency_id: currencyId
        };
        
        if (photoId !== undefined) updateData.photo_id = photoId;
        if (videoId !== undefined) updateData.video_id = videoId;
        if (mediaType !== undefined) updateData.media_type = mediaType;
        
        const item = await Item.findByIdAndUpdate(
            itemId,
            updateData,
            { new: true }
        );
        return item;
    }

    async getAllItems() {
        return await Item.find({ is_active: true })
            .populate('category_id', 'name emoji')
            .populate('subcategory_id', 'name')
            .populate('currency_id', 'name emoji')
            .sort({ createdAt: -1 });
    }

    async getItemsByCategory(categoryId) {
        return await Item.find({ 
            category_id: categoryId,
            is_active: true 
        })
        .populate('subcategory_id', 'name')
        .populate('currency_id', 'name emoji')
        .sort({ title: 1 });
    }

    async deleteItem(itemId) {
        await Item.findByIdAndUpdate(itemId, { is_active: false });
    }

    async getAllOrders() {
        const orders = await Order.find().sort({ createdAt: -1 });

        const userIds = Array.from(new Set(orders.map(o => o.user_id).filter(Boolean)));
        const users = await User.find({ user_id: { $in: userIds } })
            .select('user_id first_name username')
            .lean();
        const usersMap = new Map(users.map(u => [u.user_id, u]));

        return orders.map(order => {
            const user = usersMap.get(order.user_id);
            return {
                id: order._id,
                user_id: order.user_id,
                first_name: user ? user.first_name : null,
                username: user ? user.username : null,
                date_requested: order.date_requested,
                comment: order.comment,
                status: order.status,
                items_count: order.items.length,
                created_at: order.createdAt
            };
        });
    }

    async getOrderDetails(orderId) {
        const order = await Order.findById(orderId)
            .populate('items.currency_id', 'name emoji');
        
        if (!order) {
            return null;
        }

        const user = await User.findOne({ user_id: order.user_id });
        
        return {
            order: {
                id: order._id,
                user_id: order.user_id,
                first_name: user ? user.first_name : null,
                username: user ? user.username : null,
                date_requested: order.date_requested,
                comment: order.comment,
                status: order.status,
                created_at: order.createdAt
            },
            items: order.items.map(item => ({
                id: item._id,
                item_id: item.item_id,
                custom_text: item.custom_text,
                title: item.title,
                price_amount: item.price_amount,
                currency_id: item.currency_id ? item.currency_id._id : null,
                currency_name: item.currency_id ? item.currency_id.name : null,
                currency_emoji: item.currency_id ? item.currency_id.emoji : null
            }))
        };
    }

    async updateOrderStatus(orderId, status) {
        await Order.findByIdAndUpdate(orderId, { status: status });
    }

    async addSpecialMenu(photoId, videoId, description, priceAmount = 0, currencyId = null) {
        // Деактивуємо попереднє спецменю
        await SpecialMenu.updateMany({}, { is_active: false });
        
        // Додаємо нове
        const specialMenuData = {
            photo_id: photoId,
            video_id: videoId,
            description: description,
            price_amount: priceAmount || 0,
            is_active: true
        };
        
        if (currencyId) {
            specialMenuData.currency_id = currencyId;
        }
        
        const specialMenu = await SpecialMenu.create(specialMenuData);
        return specialMenu;
    }

    async getCurrencies() {
        return await Currency.find().sort({ _id: 1 });
    }

    async getCategories() {
        return await Category.find().sort({ _id: 1 });
    }

    async getSubcategories(categoryId) {
        return await Subcategory.find({ category_id: categoryId }).sort({ _id: 1 });
    }

    async getCategoryById(categoryId) {
        return await Category.findById(categoryId);
    }
}

module.exports = new AdminService();