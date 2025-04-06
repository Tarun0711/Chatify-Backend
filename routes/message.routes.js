import express from 'express';
import { sendMessage, getMessages, markMessageAsSeen, deleteMessage } from "../controllers/message.controller.js";
import protectRoute from '../middleware/protectRoute.js';

const router = express.Router();

router.post("/send/:id", protectRoute, sendMessage);
router.get("/getMessages/:id", protectRoute, getMessages);
router.put("/seen/:messageId", protectRoute, markMessageAsSeen);
router.delete("/delete/:messageId", protectRoute, deleteMessage);

export default router; 