const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const aiController = require("../controllers/aiChatController");

router.post("/chat", authMiddleware, aiController.chatWithAI);

module.exports = router;
