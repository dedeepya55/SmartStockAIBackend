const express = require("express");
const { loginUser, sendOtp, verifyOtp, resetPassword } = require("../controllers/authController");

const router = express.Router();

router.post("/login", loginUser);
router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.post("/reset-password", resetPassword);

module.exports = router;
