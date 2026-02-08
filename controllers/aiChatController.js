const Product = require("../models/Product");
const User = require("../models/User");

exports.chatWithAI = async (req, res) => {
  try {
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({ message: "Question is required" });
    }

    const q = question.toLowerCase();

    // 🔹 LOW STOCK PRODUCTS
    if (q.includes("low stock") || q.includes("running low")) {
      const products = await Product.find({
        QTY: { $gt: 0 },
        $expr: { $lt: ["$QTY", "$minStock"] }
      }).select("Title SKU QTY minStock Warehouse Category");

      return res.json({
        message: products.length
          ? `⚠️ ${products.length} product(s) are running low`
          : "✅ No low stock products found",
        data: products
      });
    }

    // 🔹 OUT OF STOCK PRODUCTS
    if (q.includes("out of stock") || q.includes("no stock")) {
      const products = await Product.find({
        QTY: 0
      }).select("Title SKU Warehouse Category");

      return res.json({
        message: products.length
          ? `❌ ${products.length} product(s) are out of stock`
          : "✅ No out of stock products",
        data: products
      });
    }

    // 🔹 OVER STOCK PRODUCTS
    if (q.includes("overstock") || q.includes("excess stock")) {
      const products = await Product.find({
        $expr: { $gt: ["$QTY", "$maxStock"] }
      }).select("Title SKU QTY maxStock Warehouse Category");

      return res.json({
        message: products.length
          ? `📦 ${products.length} product(s) are overstocked`
          : "✅ No overstocked products",
        data: products
      });
    }

    // 🔹 ALERTS / NOTIFICATIONS
    if (q.includes("alert") || q.includes("notification")) {
      const users = await User.find({}, { notifications: 1 });

      const alerts = users.flatMap(u => u.notifications || []);

      return res.json({
        message: alerts.length
          ? `🔔 ${alerts.length} active alert(s)`
          : "✅ No active alerts",
        data: alerts
      });
    }

    // 🔹 MISPLACED PRODUCTS (AI BASED)
    if (q.includes("misplaced")) {
      return res.json({
        message:
          "🧠 Misplaced products are detected using shelf image AI. Please upload an image in the 'Misplaced Products' section to analyze shelf arrangement."
      });
    }

    // 🔹 FALLBACK RESPONSE
    return res.json({
      message:
        "🤖 I can help with stock levels, alerts, and AI checks. Try asking:\n• low stock products\n• out of stock items\n• alerts\n• misplaced products"
    });

  } catch (err) {
    console.error("AI Chat Error:", err);
    res.status(500).json({ message: "AI chat failed" });
  }
};
