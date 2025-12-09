const Category = require('../models/Category');
const Subcategory = require('../models/Subcategory');
const Item = require('../models/Item');
const SpecialMenu = require('../models/SpecialMenu');

class MenuService {
    async getCategories() {
        return await Category.find().sort({ _id: 1 });
    }

    async getSubcategories(categoryId) {
        return await Subcategory.find({ category_id: categoryId }).sort({ _id: 1 });
    }

    async getItemsBySubcategory(subcategoryId) {
        return await Item.find({ 
            subcategory_id: subcategoryId, 
            is_active: true 
        })
        .populate('currency_id', 'name emoji')
        .populate('category_id', 'name emoji')
        .sort({ _id: 1 });
    }

    async getItemById(itemId) {
        const item = await Item.findOne({ 
            _id: itemId, 
            is_active: true 
        })
        .populate('currency_id', 'name emoji')
        .populate('category_id', 'name emoji');
        
        return item;
    }

    async getSpecialMenu() {
        return await SpecialMenu.findOne({ is_active: true })
            .populate('currency_id', 'name emoji')
            .sort({ createdAt: -1 });
    }
}

module.exports = new MenuService();