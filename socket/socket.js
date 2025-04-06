import { Server } from "socket.io";
import http from "http";
import express from 'express';
import Message from '../models/message.model.js';
import Conversation from '../models/conversation.model.js';
import redisClient from '../config/redis.js';

const app = express();

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: ['https://chatify-frontend-six.vercel.app', 'http://localhost:3000'],
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        credentials: true,
    }
});

const getReceiverSocketId = (receiverId)=>{
    return userSocketMap[receiverId]
}

const userSocketMap = {}; // {userId:socketId}

// Function to save temporary message to database
const saveTemporaryMessage = async (message) => {
    try {
        // Check Redis cache for conversation
        const cacheKey = `conversation:${message.senderId}:${message.receiverId}`;
        let cachedConversation = await redisClient.get(cacheKey);
        let conversation;
        
        if (!cachedConversation) {
            conversation = await Conversation.findOne({
                participants: { $all: [message.senderId, message.receiverId] }
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
                participants: [message.senderId, message.receiverId]
            });
            await redisClient.set(cacheKey, JSON.stringify(conversation));
        }

        const newMessage = new Message({
            senderId: message.senderId,
            receiverId: message.receiverId,
            message: message.message,
            isTemp: true,
            createdAt: message.createdAt
        });

        if (newMessage) {
            conversation.messages.push(newMessage._id);
        }

        // Save both the message and conversation
        await newMessage.save();
        await conversation.save();

        // Clear both sender and receiver message caches
        const senderMessagesCacheKey = `messages:${message.senderId}:${message.receiverId}`;
        const receiverMessagesCacheKey = `messages:${message.receiverId}:${message.senderId}`;
        await Promise.all([
            redisClient.del(senderMessagesCacheKey),
            redisClient.del(receiverMessagesCacheKey)
        ]);

        // Populate the message with user details before returning
        const populatedMessage = await Message.findById(newMessage._id)
            .populate('senderId', 'fullName profilePicture')
            .populate('receiverId', 'fullName profilePicture');

        return populatedMessage;
    } catch (error) {
        console.error('Error saving temporary message:', error);
        return null;
    }
};

io.on('connection', (socket) => {
    console.log(`user connected ${socket.id}`);

    const userId = socket.handshake.query.userId;

    if (userId != "undefined") {
        userSocketMap[userId] = socket.id;
    }

    //io.emit() is used to send event to all connected clients
    io.emit("getOnlineUsers", Object.keys(userSocketMap));

    // Handle message sending
    socket.on("sendMessage", async ({ message, receiverId }) => {
        const receiverSocketId = getReceiverSocketId(receiverId);
        if (receiverSocketId) {
            // Only send if the message has a unique ID
            if (message._id) {
                // If it's a temporary message, save it to database after a delay
                if (message.isTemp) {
                    setTimeout(async () => {
                        const savedMessage = await saveTemporaryMessage(message);
                        if (savedMessage) {
                            // Send the saved message to both sender and receiver
                            io.to(socket.id).emit("messageSaved", savedMessage);
                            io.to(receiverSocketId).emit("messageSaved", savedMessage);
                        }
                    }, 5000); // Save after 5 seconds
                }

                // Populate the message with user details before sending
                const populatedMessage = {
                    ...message,
                    senderId: {
                        _id: message.senderId,
                        fullName: message.senderName,
                        profilePicture: message.senderProfilePicture
                    },
                    receiverId: {
                        _id: message.receiverId,
                        fullName: message.receiverName,
                        profilePicture: message.receiverProfilePicture
                    }
                };

                // Send to specific user
                io.to(receiverSocketId).emit("newMessage", populatedMessage);
            }
        }
    });

    // socket.on() is used to listen to events, can be used both on client and server side
    socket.on("disconnect", () => {
        console.log(`user disconnected ${socket.id}`);
        delete userSocketMap[userId]
        io.emit("getOnlineUsers", Object.keys(userSocketMap));
    })
})

export { app, io, server, getReceiverSocketId };