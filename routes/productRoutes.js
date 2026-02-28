const express = require("express");
const router = express.Router();

const productController = require("../controllers/productController");
const authMiddleware = require("../middleware/authMiddleware");

// const orderController = require("../controllers/orderController"); 

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
// MISPLACED PRODUCTS CHECK
router.post(
  "/misplaced-check",
  upload.single("productImage"), // must match frontend FormData key
  productController.checkMisplacedProducts // make sure controller function name matches
);

// DASHBOARD ANALYTICS
router.get("/orders/summary", productController.getOrderSummary);
router.get("/revenue/weekly", productController.getWeeklyRevenue);
router.get("/revenue/monthly", productController.getMonthlyRevenue);
router.get("/revenue/yearly", productController.getYearlyRevenue);
router.get("/products/top-selling", productController.getTopSellingProducts);

// GET all orders
router.get("/orders", productController.getOrders);

// CREATE new order
router.post("/orders", productController.createOrder);


// GET shipping info
router.get("/orders/:orderId/shipping", productController.getShippingInfo);

// UPDATE shipping status
router.put("/orders/:orderId/shipping", productController.updateShippingStatus);


module.exports = router;
