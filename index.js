import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { app, server } from './socket/socket.js';

import connectToMongodb from './db/connectToMongodb.js';
import authRoutes from './routes/auth.routes.js'
import messagesRoutes from './routes/message.routes.js'
import userRoutes from './routes/user.routes.js'

const PORT = process.env.PORT || 5000;

dotenv.config();

// CORS configuration
const corsOptions = {
    origin: ['https://chatify-frontend-six.vercel.app', 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/messages", messagesRoutes);
app.use("/api/users", userRoutes);

server.listen(PORT, ()=>{
    connectToMongodb();
    console.log(`Server is runnning on port ${PORT}`);
})