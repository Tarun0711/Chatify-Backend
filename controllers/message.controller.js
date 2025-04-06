import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import { getReceiverSocketId, io } from "../socket/socket.js";
import redisClient from "../config/redis.js";
import { produceMessage } from "../config/kafka.js";

export const sendMessage = async (req, res) => {
    try {
        const { message, isTemp = false } = req.body;
        const { id: receiverId } = req.params;
        const senderId = req.user._id;

        // Check Redis cache for conversation 
        const cacheKey = `conversation:${senderId}:${receiverId}`;
        let cachedConversation = await redisClient.get(cacheKey);
        let conversation;
        
        if (!cachedConversation) {
            conversation = await Conversation.findOne({
                participants: { $all: [senderId, receiverId] }
            });
            
            if (conversation) {
                await redisClient.set(cacheKey, JSON.stringify(conversation));
            }
        } else {
            // If we have cached data, find the actual conversation document
            const parsedConversation = JSON.parse(cachedConversation);
            conversation = await Conversation.findById(parsedConversation._id);
        }

        if (!conversation) {
            conversation = await Conversation.create({
                participants: [senderId, receiverId]
            });
            await redisClient.set(cacheKey, JSON.stringify(conversation));
        }

        const newMessage = new Message({
            senderId,
            receiverId,
            message,
            isTemp
        });

        if (newMessage) {
            conversation.messages.push(newMessage._id);
        }

        // Save both the message and conversation
        await newMessage.save();
        await conversation.save();

        // Clear the messages cache since we have a new message
        const messagesCacheKey = `messages:${senderId}:${receiverId}`;
        await redisClient.del(messagesCacheKey);

        // Send message to Kafka
        await produceMessage({
            type: 'new_message',
            message: newMessage,
            conversationId: conversation._id
        });

        const receiverSocketId = getReceiverSocketId(receiverId);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("newMessage", newMessage);
        }

        res.status(201).json(newMessage);
    } catch (error) {
        console.log(`Error in sending message: ${error.message}`);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getMessages = async (req, res) => {
    try {
        const { id: userToChatId } = req.params;
        const senderId = req.user._id;

        const cacheKey = `messages:${senderId}:${userToChatId}`;
        let messages = await redisClient.get(cacheKey);

        if (!messages) {
            // Find all messages between the two users
            messages = await Message.find({
                $or: [
                    { senderId, receiverId: userToChatId },
                    { senderId: userToChatId, receiverId: senderId }
                ]
            })
            .sort({ createdAt: 1 }) // Sort by creation time
            .populate('senderId', 'fullName profilePicture') // Populate sender details
            .populate('receiverId', 'fullName profilePicture'); // Populate receiver details

            if (!messages || messages.length === 0) {
                return res.status(200).json([]);
            }

            // Convert to plain objects for caching
            const messagesToCache = messages.map(msg => msg.toObject());
            await redisClient.set(cacheKey, JSON.stringify(messagesToCache));
        } else {
            messages = JSON.parse(messages);
        }

        res.status(200).json(messages);
    } catch (error) {
        console.log(`Error in getMessages: ${error.message}`);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const markMessageAsSeen = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user._id;

        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({ error: "Message not found" });
        }

        if (message.receiverId.toString() !== userId.toString()) {
            return res.status(403).json({ error: "Unauthorized" });
        }

        message.seen = true;
        await message.save();

        // Clear cache
        const cacheKey = `messages:${message.senderId}:${message.receiverId}`;
        await redisClient.del(cacheKey);

        res.status(200).json({ message: "Message marked as seen" });
    } catch (error) {
        console.log(`Error in markMessageAsSeen: ${error.message}`);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const deleteMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user._id;

        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({ error: "Message not found" });
        }

        if (message.senderId.toString() !== userId.toString()) {
            return res.status(403).json({ error: "Unauthorized" });
        }

        message.deleted = true;
        await message.save();

        // Clear cache
        const cacheKey = `messages:${message.senderId}:${message.receiverId}`;
        await redisClient.del(cacheKey);

        res.status(200).json({ message: "Message deleted successfully" });
    } catch (error) {
        console.log(`Error in deleteMessage: ${error.message}`);
        res.status(500).json({ error: "Internal server error" });
    }
};