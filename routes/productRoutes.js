const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
const upload = require("../middleware/upload");
const { checkProductQuality } = require("../controllers/productController");

router.get("/", productController.getProducts);
router.get("/filters", productController.getFilterOptions);
router.post("/", productController.addProduct);

router.get("/sku/:sku", productController.getProductBySKU);
router.put("/sku/:sku", productController.updateProductBySKU);

router.get("/inventory/analytics/:sku", productController.getInventoryAnalytics);


router.post(
  "/quality-check",
  upload.single("productImage"),
  checkProductQuality
);

module.exports = router;
