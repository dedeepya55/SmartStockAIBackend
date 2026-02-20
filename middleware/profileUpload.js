const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure profile folder exists
const profileDir = "public/uploads/profiles";
if (!fs.existsSync(profileDir)) {
  fs.mkdirSync(profileDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, profileDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, "profile-" + Date.now() + ext);
  }
});

const profileUpload = multer({ storage });

module.exports = profileUpload;