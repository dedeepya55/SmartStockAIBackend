const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  message: String,
  type: {
    type: String,
    enum: ["DEFECT", "INFO"],
    default: "INFO",
  },
  read: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["admin", "manager", "worker"],
      required: true,
    },

    // 🔔 EMBEDDED NOTIFICATIONS
    notifications: [notificationSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
