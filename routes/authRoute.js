const express = require("express");
const { loginUser, sendOtp, verifyOtp, resetPassword } = require("../controllers/authController");
const { changePassword } = require("../controllers/authController");

const authMiddleware = require("../middleware/authMiddleware");
const profileUpload = require("../middleware/profileUpload");
const { getProfile, updateProfile } = require("../controllers/userController");

const router = express.Router();

router.post("/login", loginUser);
router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.post("/reset-password", resetPassword);

console.log("Loading");
router.get("/profile", authMiddleware, getProfile);

router.put(
  "/profile",
  authMiddleware,
  profileUpload.single("profileImage"),
  updateProfile
);

router.put("/change-password", authMiddleware, changePassword);

module.exports = router;
