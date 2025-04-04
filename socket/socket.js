import { Server } from "socket.io";
import http from "http";
import express from 'express';

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


io.on('connection', (socket) => {
    console.log(`user connected ${socket.id}`);

    const userId = socket.handshake.query.userId;

    if (userId != "undefined") {
        userSocketMap[userId] = socket.id;
    }

    //io.emit() is used to send event to all connected clients
    io.emit("getOnlineUsers", Object.keys(userSocketMap));

    // socket.on() is used to listen to events, can be used both on client and server side
    socket.on("disconnect", () => {
        console.log(`user disconnected ${socket.id}`);
        delete userSocketMap[userId]
        io.emit("getOnlineUsers", Object.keys(userSocketMap));
    })
})

export { app, io, server, getReceiverSocketId };