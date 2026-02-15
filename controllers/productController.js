const Product = require("../models/Product");
const User = require("../models/User");
const Order = require("../models/Order");

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const { exec } = require("child_process");



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
   // ================= MONTHLY TREND (GROUPED BY YEAR) =================

const monthlyTrendByYear = {};

// 🔹 Process IN Dates
product.inDates.forEach((entry) => {
  const date = new Date(entry.date);
  const year = date.getFullYear();
  const month = date.toLocaleString("default", { month: "short" });

  if (!monthlyTrendByYear[year]) {
    monthlyTrendByYear[year] = {};
  }

  if (!monthlyTrendByYear[year][month]) {
    monthlyTrendByYear[year][month] = { inQty: 0, outQty: 0 };
  }

  monthlyTrendByYear[year][month].inQty += entry.qty;
});

// 🔹 Process OUT Dates
product.outDates.forEach((entry) => {
  const date = new Date(entry.date);
  const year = date.getFullYear();
  const month = date.toLocaleString("default", { month: "short" });

  if (!monthlyTrendByYear[year]) {
    monthlyTrendByYear[year] = {};
  }

  if (!monthlyTrendByYear[year][month]) {
    monthlyTrendByYear[year][month] = { inQty: 0, outQty: 0 };
  }

  monthlyTrendByYear[year][month].outQty += entry.qty;
});

// 🔹 Sort Years
const sortedYears = Object.keys(monthlyTrendByYear)
  .map(Number)
  .sort((a, b) => a - b);

// 🔹 Month Order
const monthOrder = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec"
];

// 🔹 Final Structured Data
const monthlyData = sortedYears.map((year) => ({
  year,
  months: monthOrder
    .filter((m) => monthlyTrendByYear[year][m])
    .map((month) => ({
      month,
      inQty: monthlyTrendByYear[year][month].inQty,
      outQty: monthlyTrendByYear[year][month].outQty
    }))
}));


    // ================= RETURN =================
   res.json({
  sku: product.SKU,
  qty: product.QTY,
  soldQty,
  price: product.Price,
  yearlyTrend: yearlyData,
  monthlyTrend: monthlyData, // grouped by year
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

exports.productQualityCheck = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image uploaded" });
    }

    // Uploaded image path
    const imagePath = req.file.path;

    // Path to infer.py
    const pythonScriptPath = path.join(
      __dirname,
      "..",
      "SMARTSTOCKAI-AI",
      "infer.py"
    );

    let pythonOutput = "";
    let pythonError = "";

    const pythonProcess = spawn("python", [
      pythonScriptPath,
      imagePath,
    ]);

    pythonProcess.stdout.on("data", (data) => {
      pythonOutput += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      pythonError += data.toString();
    });

    pythonProcess.on("close", async (code) => {
      if (code !== 0) {
        console.error("Python error:", pythonError);
        return res.status(500).json({
          message: "AI processing failed",
        });
      }

      try {
        // ✅ IMPORTANT: extract only the last JSON line
        const lines = pythonOutput.trim().split("\n");
        const jsonLine = lines[lines.length - 1];

        const result = JSON.parse(jsonLine);

       if (result.status === "NOT_OK") {
          await User.updateMany(
            { role: { $in: ["worker", "manager"] } },
            {
              $push: {
                notifications: {
                  message: "❌ Defective product detected",
                  type: "DEFECT",
                },
              },
            }
          );
        }

        // Convert absolute path → relative path for frontend
        const relativeOutputPath = path
          .relative(process.cwd(), result.output_image_path)
          .replace(/\\/g, "/");

       return res.json({
  status: result.status,
  message: result.message,
  outputImage: relativeOutputPath,
});

      } catch (err) {
        console.error("JSON parse error:", err);
        console.error("Python raw output:", pythonOutput);

        return res.status(500).json({
          message: "Invalid AI response",
        });
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getNotifications = async (req, res) => {
  const userId = req.user.id;

  const user = await User.findById(userId);
  res.json(user.notifications.reverse());
};
exports.deleteNotification = async (req, res) => {
  const userId = req.user.id;
  const { notificationId } = req.params;

  await User.updateOne(
    { _id: userId },
    { $pull: { notifications: { _id: notificationId } } }
  );

  res.json({ message: "Notification deleted" });
};

exports.checkMisplacedProducts = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No image uploaded" });

    // 🔹 Absolute path for uploaded image
    const imagePath = path.resolve(req.file.path); 
    console.log("Image path (absolute):", imagePath);

    // 🔹 Correct Python script path
    const pythonScriptPath = path.join(
      __dirname,
      "..",
      "SMARTSTOCK_AI2",
      "run_full_pipeline.py"
    );
    console.log("Python script path:", pythonScriptPath);

    // 🔹 Spawn Python process
    const pythonProcess = spawn("python", [
      pythonScriptPath,
      "--image",
      imagePath.replace(/\\/g, "/") // forward slashes
    ]);

    let pythonOutput = "";
    let pythonError = "";

    pythonProcess.stdout.on("data", (data) => {
      const text = data.toString();
      pythonOutput += text;
      console.log("[PYTHON STDOUT]:", text); // log every stdout
    });

    pythonProcess.stderr.on("data", (data) => {
      const text = data.toString();
      pythonError += text;
      console.error("[PYTHON STDERR]:", text); // log errors
    });

    pythonProcess.on("error", (err) => {
      console.error("Failed to start Python process:", err);
    });

    pythonProcess.on("close", async (code) => {
      console.log("Python process exited with code:", code);

      if (code !== 0) {
        console.error("Python script failed:", pythonError);
        return res.status(500).json({ error: "Python script failed", details: pythonError });
      }

      try {
        // 🔹 Paths to results
        const resultsFolder = path.join(__dirname, "..", "SMARTSTOCK_AI2", "results");
        const annotatedImageName = "annotated_" + path.basename(imagePath);
        const annotatedImagePath = path.join(resultsFolder, annotatedImageName);
        const jsonPath = path.join(resultsFolder, "detection_results.json");

        console.log("Checking results folder:", resultsFolder);
        console.log("Expected annotated image path:", annotatedImagePath);
        console.log("Expected JSON path:", jsonPath);

        // 🔹 Check if result files exist
        if (!fs.existsSync(annotatedImagePath)) console.error("Annotated image NOT found!");
        if (!fs.existsSync(jsonPath)) console.error("JSON results NOT found!");

        if (!fs.existsSync(annotatedImagePath) || !fs.existsSync(jsonPath)) {
          return res.status(500).json({ 
            error: "Result files not found",
            pythonOutput,
            pythonError
          });
        }

        // 🔹 Read JSON results
        const jsonData = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

        // 🔹 Return annotated image path + results
        res.json({
          message: "Image processed successfully",
          image: `/results/${annotatedImageName}`,
          results: jsonData,
        });

      } catch (err) {
        console.error("Error reading result files:", err);
        res.status(500).json({ error: "Failed to read result files", details: err.message });
      }
    });

  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
};


// GET all orders
exports.getOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("items.product") // fetch product details
      .sort({ orderDate: -1 });

    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
// CREATE new order
exports.createOrder = async (req, res) => {
  try {
    const { orderId, shopName, items } = req.body;

    if (!items || items.length === 0)
      return res.status(400).json({ message: "No items in order" });

    // Calculate total price
    let totalPrice = 0;
    for (let i = 0; i < items.length; i++) {
      const product = await Product.findById(items[i].product);
      if (!product)
        return res.status(404).json({ message: `Product not found: ${items[i].product}` });
      totalPrice += product.Price * items[i].quantity;
    }

    const newOrder = new Order({
      orderId,
      shopName,
      items,
      totalPrice,
      status: "Pending",
      shippingHistory: [
        { status: "Ordered", timestamp: new Date() } // initial shipping entry
      ],
    });

    await newOrder.save();
    res.status(201).json(newOrder);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getShippingInfo = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findOne({ orderId }).populate("items.product");

    if (!order) return res.status(404).json({ message: "Order not found" });

    res.json({
      orderId: order.orderId,
      shopName: order.shopName,
      totalPrice: order.totalPrice,
      status: order.status,
      items: order.items,
      shippingHistory: order.shippingHistory || [],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
exports.updateShippingStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: "Shipping status is required" });
    }

    const order = await Order.findOne({ orderId });
    if (!order) return res.status(404).json({ message: "Order not found" });

    order.status = status;
    order.shippingHistory.push({ status, timestamp: new Date() });
    await order.save();

    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
