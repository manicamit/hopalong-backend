import { Router } from "express";
import ChatController from "../controllers/chatController";

const router = Router();

// subscribe to a chat
router.post("/subscribe", ChatController.subscribeToChat);

// get previous messages
router.post("/previous", ChatController.getPreviousMessages);

// send a message
router.post("/send", ChatController.sendMessage);

// get all chats
router.get("/all", ChatController.getAllChats);

export default router;
