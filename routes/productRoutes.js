const express = require("express");
const router = express.Router();

const productController = require("../controllers/productController");
const authMiddleware = require("../middleware/authMiddleware");

const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext);
  },
});

const upload = multer({ storage });

// PRODUCTS
router.get("/", productController.getProducts);
router.get("/filters", productController.getFilterOptions);
router.post("/", productController.addProduct);

router.get("/sku/:sku", productController.getProductBySKU);
router.put("/sku/:sku", productController.updateProductBySKU);

router.get(
  "/inventory/analytics/:sku",
  productController.getInventoryAnalytics
);

// QUALITY CHECK
router.post(
  "/quality-check",
  upload.single("productImage"),
  productController.productQualityCheck
);

// 🔔 NOTIFICATIONS (IMPORTANT)
router.get(
  "/notifications",
  authMiddleware,
  productController.getNotifications
);

router.delete(
  "/notifications/:notificationId",
  authMiddleware,
  productController.deleteNotification
);

module.exports = router;
