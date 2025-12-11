const fs = require('fs');
const path = require('path');
const menuService = require('../services/menuService');
const cartService = require('../services/cartService');
const Keyboards = require('../helpers/keyboards');
const Messages = require('../helpers/messages');
const { getLocalMediaPath } = require('../config/localMediaMap');
const Item = require('../models/Item');

class MenuHandlers {
    constructor(bot) {
        this.bot = bot;
        this.userStates = new Map(); // Зберігаємо стан користувача
        this.userMessages = new Map(); // Зберігаємо message_id для редагування
        this.mediaCache = new Map(); // itemId -> { mediaType, fileId }
    }

    // Визначає, що і як відправляти (локальний файл, file_id або URL)
    getMediaPayload(item) {
        const mediaType = item.media_type === 'video'
            ? 'video'
            : (item.media_type === 'gif' ? 'animation' : 'photo');

        const cached = this.mediaCache.get(item._id.toString());
        const localPathCandidate = getLocalMediaPath(item.title);
        if (cached) {
            return { mediaType: cached.mediaType, media: cached.fileId, cached: true, localPathCandidate };
        }

        const localPath = localPathCandidate;
        if (localPath && fs.existsSync(localPath)) {
            // Використовуємо стрім, щоб Telegram отримав multipart із файлом
            return { mediaType, media: fs.createReadStream(localPath), local: true, localPath, localPathCandidate };
        }

        if (item.video_id) {
            return { mediaType: 'video', media: item.video_id, localPathCandidate };
        }

        if (item.photo_id) {
            const type = item.media_type === 'gif' ? 'animation' : 'photo';
            return { mediaType: type, media: item.photo_id, localPathCandidate };
        }

        if (item.photo_url) {
            const p = item.photo_url;
            const looksLocal = p.startsWith('/') || p.startsWith('\\') || p.includes('\\') || p.includes('/src/') || p.includes('/app/');
            if (looksLocal) {
                const absPath = path.isAbsolute(p) ? p : path.join(process.cwd(), p);
                // Try explicit path
                if (fs.existsSync(absPath)) {
                    return { mediaType, media: fs.createReadStream(absPath), local: true, localPath: absPath, localPathCandidate: absPath };
                }
                // Try mapped local path as fallback
                if (localPathCandidate && fs.existsSync(localPathCandidate)) {
                    return { mediaType, media: fs.createReadStream(localPathCandidate), local: true, localPath: localPathCandidate, localPathCandidate };
                }
                // If file is missing locally, do not send a string path (Telegram will reject)
                return null;
            }
            return { mediaType, media: p, localPathCandidate };
        }

        return null;
    }

    // Допоміжний метод для редагування або відправки повідомлення
    async editOrSendMessage(bot, userId, message, text, keyboard = null) {
        try {
            if (message && message.message_id) {
                try {
                    await bot.editMessageText(text, {
                        chat_id: userId,
                        message_id: message.message_id,
                        ...keyboard,
                        parse_mode: keyboard ? 'Markdown' : undefined
                    });
                    this.userMessages.set(userId, message.message_id);
                    return;
                } catch (error) {
                    // Якщо повідомлення містить медіа або не може бути відредаговане - видаляємо і надсилаємо нове
                    if (error.response && error.response.body && error.response.body.description) {
                        const errorDesc = error.response.body.description;
                        // Якщо помилка "message can't be edited" або повідомлення містить медіа
                        if (errorDesc.includes("can't be edited") || errorDesc.includes("message is not modified")) {
                            try {
                                // Видаляємо старе повідомлення
                                await bot.deleteMessage(userId, message.message_id);
                            } catch (deleteError) {
                                // Ігноруємо помилки видалення
                            }
                        } else if (errorDesc.includes('not modified')) {
                            // Якщо текст не змінився, просто виходимо
                            return;
                        }
                    }
                }
            }
            const sent = await bot.sendMessage(userId, text, {
                ...keyboard,
                parse_mode: keyboard ? 'Markdown' : undefined
            });
            this.userMessages.set(userId, sent.message_id);
        } catch (error) {
            console.error('Error in editOrSendMessage:', error);
            const sent = await bot.sendMessage(userId, text, {
                ...keyboard,
                parse_mode: keyboard ? 'Markdown' : undefined
            });
            this.userMessages.set(userId, sent.message_id);
        }
    }

    // Допоміжний метод для редагування медіа
    async editOrSendMedia(bot, userId, message, item, mediaPayload, caption, keyboard = null) {
        const { mediaType, media, local, cached, localPath, localPathCandidate } = mediaPayload;
        const canEdit = message && message.message_id && !local;
        const fallbackLocalPath = localPath || localPathCandidate;

        const trySend = async (source) => {
            if (mediaType === 'video') {
                return bot.sendVideo(userId, source, {
                    caption,
                    ...keyboard,
                    parse_mode: 'Markdown'
                });
            }
            if (mediaType === 'animation') {
                return bot.sendAnimation(userId, source, {
                    caption,
                    ...keyboard,
                    parse_mode: 'Markdown'
                });
            }
            return bot.sendPhoto(userId, source, {
                caption,
                ...keyboard,
                parse_mode: 'Markdown'
            });
        };

        try {
            if (canEdit) {
                try {
                    await bot.editMessageMedia({
                        type: mediaType === 'animation' ? 'animation' : mediaType,
                        media,
                        caption,
                        parse_mode: 'Markdown'
                    }, {
                        chat_id: userId,
                        message_id: message.message_id,
                        ...keyboard
                    });
                    return;
                } catch (error) {
                    const desc = error?.response?.body?.description || '';
                    const badFile = desc.includes('wrong file identifier') || desc.includes('FILE_REFERENCE_');
                    // Якщо file_id протух або неправильний — пробуємо відправити файл заново
                    if (!badFile) {
                        try { await bot.deleteMessage(userId, message.message_id); } catch (_) {}
                    } else {
                        // Протухлий file_id — очистимо кеш і будемо слати заново
                        this.mediaCache.delete(item._id.toString());
                        try { await bot.deleteMessage(userId, message.message_id); } catch (_) {}
                    }
                }
            } else if (message && message.message_id && local) {
                try { await bot.deleteMessage(userId, message.message_id); } catch (_) {}
            }

            // Вибираємо джерело для повторної відправки
            let source = media;
            let usedLocalPath = localPath;
            if (fallbackLocalPath && fs.existsSync(fallbackLocalPath)) {
                source = fs.createReadStream(fallbackLocalPath);
                usedLocalPath = fallbackLocalPath;
            }

            let sent;
            try {
                sent = await trySend(source);
            } catch (errSend) {
                const desc = errSend?.response?.body?.description || '';
                const badFile = desc.includes('wrong file identifier') || desc.includes('FILE_REFERENCE_');
                console.warn('⚠️ [MEDIA] send failed, will retry if local exists', {
                    itemId: item._id.toString(),
                    title: item.title,
                    desc
                });
                // Якщо ще раз упало через file_id, пробуємо локальний файл (якщо ще не пробували)
                if (!usedLocalPath && fallbackLocalPath && fs.existsSync(fallbackLocalPath)) {
                    try {
                        sent = await trySend(fs.createReadStream(fallbackLocalPath));
                        usedLocalPath = fallbackLocalPath;
                    } catch (err2) {
                        throw err2;
                    }
                } else if (!badFile) {
                    throw errSend;
                } else {
                    throw errSend;
                }
            }

            // Кешуємо file_id для подальшого редагування
            let fileId = null;
            if (sent.video) fileId = sent.video.file_id;
            else if (sent.animation) fileId = sent.animation.file_id;
            else if (sent.photo && sent.photo.length) fileId = sent.photo[sent.photo.length - 1].file_id;

            if (fileId) {
                const mediaTypeToStore = mediaType === 'animation' ? 'animation' : mediaType;
                console.log('📷 [MEDIA] Cached file_id', {
                    itemId: item._id.toString(),
                    title: item.title,
                    mediaType: mediaTypeToStore,
                    fileId,
                    localPath: usedLocalPath || localPathCandidate || null,
                });
                this.mediaCache.set(item._id.toString(), { mediaType: mediaTypeToStore, fileId });

                const update = {};
                if (mediaType === 'video') {
                    update.video_id = fileId;
                    update.media_type = 'video';
                } else {
                    update.photo_id = fileId;
                    update.media_type = mediaType === 'animation' ? 'gif' : 'photo';
                    if (usedLocalPath) {
                        update.photo_url = usedLocalPath;
                    }
                }
                try {
                    await Item.updateOne({ _id: item._id }, { $set: update });
                } catch (e) {
                    console.error('Failed to persist media file_id:', e.message);
                }
            } else {
                console.warn('⚠️ [MEDIA] No file_id returned after send', {
                    itemId: item._id.toString(),
                    title: item.title,
                    mediaType,
                    localPath: usedLocalPath || localPathCandidate || null,
                });
            }

            this.userMessages.set(userId, sent.message_id);
        } catch (error) {
            console.error('Error in editOrSendMedia:', error);
            // Якщо все впало, очищаємо кеш для цього айтема
            this.mediaCache.delete(item._id.toString());
        }
    }

    // Обробка вибору категорії
    async handleCategory(bot, msg, categoryName, message = null) {
        const userId = msg.from.id;
        const categories = await menuService.getCategories();
        const category = categories.find(c => c.name === categoryName);
        
        if (!category) {
            return this.editOrSendMessage(bot, userId, message, 'Категорія не знайдена');
        }

        const subcategories = await menuService.getSubcategories(category._id);
        const keyboard = await Keyboards.getSubcategoriesKeyboard(category._id);
        
        let text = `*${category.emoji} ${category.name}*\n\n`;
        text += 'Оберіть підкатегорію:';
        
        await this.editOrSendMessage(bot, userId, message, text, keyboard);
        
        // Зберігаємо поточну категорію
        this.userStates.set(userId, { categoryId: category._id });
    }

    // Обробка вибору підкатегорії
    async handleSubcategory(bot, msg, subcategoryName, message = null) {
        const userId = msg.from.id;
        const state = this.userStates.get(userId) || {};
        const categoryId = state.categoryId;
        
        if (!categoryId) {
            return this.editOrSendMessage(bot, userId, message, 'Спочатку оберіть категорію');
        }

        const subcategories = await menuService.getSubcategories(categoryId);
        const subcategory = subcategories.find(s => s.name === subcategoryName);
        
        if (!subcategory) {
            return this.editOrSendMessage(bot, userId, message, 'Підкатегорія не знайдена');
        }

        // Якщо це кастомна підкатегорія
        if (subcategory.is_custom) {
            this.userStates.set(userId, { 
                categoryId, 
                subcategoryId: subcategory._id,
                waitingForCustomText: true 
            });
            return this.editOrSendMessage(bot, userId, message, 
                '💬 Напиши свій варіант замовлення:',
                Keyboards.getCancelKeyboard('cancel_form')
            );
        }

        // Отримуємо товари
        const items = await menuService.getItemsBySubcategory(subcategory._id);
        
        const prevMessage = this.userMessages.get(userId) ? { message_id: this.userMessages.get(userId) } : null;
        
        if (items.length === 0) {
            return this.editOrSendMessage(bot, userId, prevMessage, 
                '😔 Товарів у цій підкатегорії поки немає',
                Keyboards.getBackToMenuKeyboard()
            );
        }

        // Якщо товар один - показуємо картку
        if (items.length === 1) {
            const item = items[0];
            const text = Messages.formatItemCard(item);
            const isRandomDate = item.title === 'Рандомное для нас двоих';
            const keyboard = Keyboards.getItemKeyboard(item._id, isRandomDate);
            
            const prevMessage = this.userMessages.get(userId) ? { message_id: this.userMessages.get(userId) } : null;
            
            const mediaPayload = this.getMediaPayload(item);

            if (mediaPayload) {
                await this.editOrSendMedia(
                    bot,
                    userId,
                    prevMessage,
                    item,
                    mediaPayload,
                    text,
                    keyboard
                );
            } else {
                await this.editOrSendMessage(bot, userId, prevMessage, text, keyboard);
            }
            return;
        }

        // Якщо товарів багато - показуємо галерею
        this.userStates.set(userId, {
            categoryId,
            subcategoryId: subcategory._id,
            galleryItems: items,
            galleryIndex: 0
        });

        await this.showGalleryItem(bot, userId, 0);
    }

    // Показати елемент галереї
    async showGalleryItem(bot, userId, index, message = null) {
        const state = this.userStates.get(userId);
        if (!state || !state.galleryItems) return;

        const items = state.galleryItems;
        if (index < 0 || index >= items.length) return;

        const item = items[index];
        const text = Messages.formatItemCard(item);
        const isRandomDate = item.title === 'Рандомное для нас двоих';
        const keyboard = isRandomDate 
            ? Keyboards.getItemKeyboard(item._id, true)
            : Keyboards.getGalleryKeyboard(index, items.length, item._id);

        state.galleryIndex = index;
        this.userStates.set(userId, state);

        // Використовуємо message з попереднього повідомлення або збережене
        const prevMessage = message || (this.userMessages.get(userId) ? { message_id: this.userMessages.get(userId) } : null);

        const mediaPayload = this.getMediaPayload(item);

        if (mediaPayload) {
            await this.editOrSendMedia(
                bot,
                userId,
                prevMessage,
                item,
                mediaPayload,
                text,
                keyboard
            );
        } else {
            console.warn('⚠️ [MEDIA] No media payload found for item', {
                itemId: item._id.toString(),
                title: item.title
            });
            await this.editOrSendMessage(bot, userId, prevMessage, text, keyboard);
        }
    }

    // Обробка кастомного тексту
    async handleCustomText(bot, msg) {
        const userId = msg.from.id;
        const state = this.userStates.get(userId);
        
        if (!state || !state.waitingForCustomText) {
            return;
        }

        const customText = msg.text;
        if (!customText || customText.trim().length === 0) {
            const messageId = this.userMessages.get(userId);
            const message = messageId ? { message_id: messageId } : null;
            return this.editOrSendMessage(bot, userId, message, 'Будь ласка, введіть текст замовлення');
        }

        // Створюємо тимчасовий товар у кошику
        // Для кастомних товарів item_id може бути null
        // Передаємо categoryId для встановлення правильної ціни
        const categoryId = state.categoryId || null;
        await cartService.addToCart(userId, null, customText.trim(), categoryId);
        
        this.userStates.delete(userId);
        
        const messageId = this.userMessages.get(userId);
        const message = messageId ? { message_id: messageId } : null;
        
        await this.editOrSendMessage(bot, userId, message, 
            '✅ Замовлення додано в кошик!',
            Keyboards.getMainMenu()
        );
    }

    // Обробка кошика
    async handleCart(bot, msg, message = null) {
        const userId = msg.from.id;
        const cartText = await Messages.formatCart(userId);
        const items = await cartService.getCartItems(userId);
        const keyboard = Keyboards.getCartKeyboard(items);
        
        await this.editOrSendMessage(bot, userId, message, cartText, keyboard);
    }

    // Обробка рахунку
    async handleAccount(bot, msg, message = null) {
        const userId = msg.from.id;
        const accountText = await Messages.formatAccount(userId);
        const keyboard = Keyboards.getAccountKeyboard();
        
        await this.editOrSendMessage(bot, userId, message, accountText, keyboard);
    }

    // Очистити стан користувача
    clearUserState(userId) {
        this.userStates.delete(userId);
    }

    // Отримати стан користувача
    getUserState(userId) {
        return this.userStates.get(userId);
    }

    // Встановити стан користувача
    setUserState(userId, state) {
        this.userStates.set(userId, state);
    }
}

module.exports = MenuHandlers;
