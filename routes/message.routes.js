import express from 'express';
import {sendMessage, getMessages} from "../controllers/message.controller.js";
import protectRoute from '../middleware/protectRoute.js';


const router  = express.Router();

router.post("/send/:id",  sendMessage);
router.get("/getMessages/:id",  getMessages);

export default router;