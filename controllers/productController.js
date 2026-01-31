const Product = require("../models/Product");

/* 🔹 GET PRODUCTS (FILTER + PAGINATION) */
exports.getProducts = async (req, res) => {
  try {
    const {
      search = "",
      category = "All",
      status = "All",
      warehouse = "All",
      page = 1,
      limit = 5,
    } = req.query;

    const query = {};

    if (search) query.SKU = { $regex: search, $options: "i" };
    if (category !== "All") query.Category = category;
    if (warehouse !== "All") query.Warehouse = warehouse;
    if (status !== "All") {
      if (status === "In Stock") query.QTY = { $gte: 10 };
      if (status === "Low Stock") query.QTY = { $gt: 0, $lt: 10 };
      if (status === "Out of Stock") query.QTY = 0;
    }

    const skip = (page - 1) * limit;
    const totalCount = await Product.countDocuments(query);

    const products = await Product.find(query)
      .skip(skip)
      .limit(Number(limit))
      .sort({ LastModified: -1 });

    res.json({
      products,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: Number(page),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* 🔹 GET FILTER OPTIONS (DYNAMIC) */
exports.getFilterOptions = async (req, res) => {
  try {
    const categories = await Product.distinct("Category");
    const warehouses = await Product.distinct("Warehouse");

    res.json({
      categories: ["All", ...categories],
      warehouses: ["All", ...warehouses],
      status: ["All", "In Stock", "Low Stock", "Out of Stock"],
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* 🔹 ADD PRODUCT */
exports.addProduct = async (req, res) => {
  try {
    const product = new Product(req.body);
    const savedProduct = await product.save();
    res.status(201).json(savedProduct);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/* GET SINGLE PRODUCT BY SKU */
exports.getProductBySKU = async (req, res) => {
  try {
    const product = await Product.findOne({
      SKU: { $regex: `^${req.params.sku}$`, $options: "i" },
    });

    if (!product) return res.status(404).json({ message: "Product not found" });

    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
/* INVENTORY ANALYTICS */
exports.getInventoryAnalytics = async (req, res) => {
  try {
    const product = await Product.findOne({
      SKU: { $regex: `^${req.params.sku}$`, $options: "i" },
    });

    if (!product) return res.status(404).json({ message: "Product not found" });

    const soldQty = product.outDates.reduce((acc, entry) => acc + entry.qty, 0);

    // ================= YEARLY TREND =================
    const yearlyTrend = {};

    // Aggregate IN quantities per year
    product.inDates.forEach((entry) => {
      const year = new Date(entry.date).getFullYear();
      if (!yearlyTrend[year]) yearlyTrend[year] = { inQty: 0, outQty: 0 };
      yearlyTrend[year].inQty += entry.qty;
    });

    // Aggregate OUT quantities per year
    product.outDates.forEach((entry) => {
      const year = new Date(entry.date).getFullYear();
      if (!yearlyTrend[year]) yearlyTrend[year] = { inQty: 0, outQty: 0 };
      yearlyTrend[year].outQty += entry.qty;
    });

    const yearlyData = Object.keys(yearlyTrend)
      .sort()
      .map((year) => ({
        year,
        inQty: yearlyTrend[year].inQty,
        outQty: yearlyTrend[year].outQty,
      }));

    // ================= MONTHLY TREND =================
    const currentYear = new Date().getFullYear(); // or you can choose another year
    const monthlyTrend = {};

    // Aggregate IN quantities per month
    product.inDates.forEach((entry) => {
      const date = new Date(entry.date);
      const year = date.getFullYear();
      if (year !== currentYear) return; // only for selected year

      const month = date.toLocaleString("default", { month: "short" }); // Jan, Feb
      if (!monthlyTrend[month]) monthlyTrend[month] = { inQty: 0, outQty: 0 };
      monthlyTrend[month].inQty += entry.qty;
    });

    // Aggregate OUT quantities per month
    product.outDates.forEach((entry) => {
      const date = new Date(entry.date);
      const year = date.getFullYear();
      if (year !== currentYear) return;

      const month = date.toLocaleString("default", { month: "short" });
      if (!monthlyTrend[month]) monthlyTrend[month] = { inQty: 0, outQty: 0 };
      monthlyTrend[month].outQty += entry.qty;
    });

    const monthOrder = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const monthlyData = monthOrder
      .filter((m) => monthlyTrend[m])
      .map((month) => ({
        month,
        inQty: monthlyTrend[month].inQty,
        outQty: monthlyTrend[month].outQty
      }));

    // ================= RETURN =================
    res.json({
      sku: product.SKU,
      qty: product.QTY,
      soldQty,
      price: product.Price,
      yearlyTrend: yearlyData,
      monthlyTrend: monthlyData,
    });
    
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


exports.updateProductBySKU = async (req, res) => {
  try {
    const { sku } = req.params;

    // 🔍 Find product
    const product = await Product.findOne({ SKU: sku });
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // 📦 Destructure body
    const {
      Title,
      Category,
      Warehouse,
      QTY,
      Price,
      minStock,
      maxStock,
      inDate,
      inQty,
      outDate,
      outQty,
    } = req.body;

    // 🔹 Update basic fields ONLY if provided
    if (Title !== undefined) product.Title = Title;
    if (Category !== undefined) product.Category = Category;
    if (Warehouse !== undefined) product.Warehouse = Warehouse;
    if (Price !== undefined) product.Price = Number(Price);
    if (minStock !== undefined) product.minStock = Number(minStock);
    if (maxStock !== undefined) product.maxStock = Number(maxStock);
     if (QTY !== undefined && !isNaN(QTY)) {
      product.QTY = Number(QTY);
    }


    // 🔹 IN STOCK (optional)
    if (inDate && Number(inQty) > 0) {
      product.inDates.push({
        date: new Date(inDate),
        qty: Number(inQty),
      });
      product.QTY += Number(inQty);
    }

    // 🔹 OUT STOCK (optional)
    if (outDate && Number(outQty) > 0) {
      product.outDates.push({
        date: new Date(outDate),
        qty: Number(outQty),
      });
      product.QTY -= Number(outQty);
    }

    // 🕒 Always update LastModified
    product.LastModified = new Date();

    // 💾 Save
    await product.save();

    // ✅ Response
    res.status(200).json({
      message: "Product updated successfully",
      product,
    });
  } catch (err) {
    console.error("Update error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


exports.checkProductQuality = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image uploaded" });
    }

    /**
     * 🔮 AI LOGIC PLACEHOLDER
     * Later replace this with:
     * - OpenCV
     * - TensorFlow
     * - YOLO model
     */

    const aiDecision = Math.random() > 0.5;

    if (aiDecision) {
      return res.json({
        status: "OK",
        message: "✅ Product is correct and properly sealed"
      });
    } else {
      return res.json({
        status: "NOT_OK",
        message: "❌ Product is not correct. Send to manufacturer"
      });
    }

  } catch (error) {
    res.status(500).json({ message: "AI processing failed" });
  }
};
