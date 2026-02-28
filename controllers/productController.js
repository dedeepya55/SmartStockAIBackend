const Product = require("../models/Product");
const User = require("../models/User");
const Order = require("../models/Order");

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const { exec } = require("child_process");


const axios = require("axios");
const FormData = require("form-data");




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
    if (!req.file) return res.status(400).json({ message: "No image uploaded" });

    const imagePath = req.file.path;
    const formData = new FormData();
    formData.append("file", fs.createReadStream(imagePath));

    const response = await axios.post(
      `${process.env.AI_SERVICE_URL_productDefect}/defect`,
      formData,
      { headers: formData.getHeaders() }
    );

    const result = JSON.parse(response.data.response); // your API wraps JSON in "response" string

    console.log("AI API result:", result); // log full result for debugging

    // Send notifications if defective
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

   res.json({
  status: result.status,
  message: result.message,
  outputImage:
    process.env.AI_SERVICE_URL_productDefect+
    result.output_image_path,
});
  } catch (err) {
    console.error("AI API error:", err.response?.data || err.message);
    res.status(500).json({ message: "AI API call failed", error: err.message });
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

    const imagePath = req.file.path; // uploaded image path
    const resultsFolder = path.join(__dirname, "..", "SMARTSTOCK_AI2", "results");

    // Ensure results folder exists
    if (!fs.existsSync(resultsFolder)) fs.mkdirSync(resultsFolder, { recursive: true });

    // Prepare form-data
    const formData = new FormData();
    formData.append("file", fs.createReadStream(imagePath));

    // Send image to your Render AI endpoint
    const response = await axios.post(
      `${process.env.AI_SERVICE_URL_arrangementCheck}/arrangement`,
      formData,
      { headers: formData.getHeaders() }
    );

    const jsonData = response.data; // your API returns JSON with status & output_image_path

    // Save annotated image locally (like Python script)
    const annotatedImageName = "annotated_" + path.basename(imagePath);
    const annotatedImagePath = path.join(resultsFolder, annotatedImageName);

    // Download output image from API if provided
    if (jsonData.output_image_path) {
      const imageResponse = await axios.get(jsonData.output_image_path, {
        responseType: "arraybuffer",
      });
      fs.writeFileSync(annotatedImagePath, imageResponse.data);
    }

    // 🔔 Notification logic
    if (jsonData.status === "INCORRECT") {
      await User.updateMany(
        {}, // send to all users
        {
          $push: {
            notifications: {
              message: "⚠️ Misplaced product detected in warehouse",
              type: "MISPLACED",
              createdAt: new Date(),
            },
          },
        }
      );
    }

    // Send same structure to frontend
    res.json({
      message: "Image processed successfully",
      image: `/results/${annotatedImageName}`, // same as Python version
      results: jsonData,
    });
  } catch (err) {
    console.error("Error in misplaced check:", err.response?.data || err.message);
    res.status(500).json({ error: "AI API call failed", details: err.message });
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

// ================= ORDER SUMMARY =================
exports.getOrderSummary = async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();

    const pendingOrders = await Order.countDocuments({ status: "Pending" });
    const shippedOrders = await Order.countDocuments({ status: "Shipped" });
    const deliveredOrders = await Order.countDocuments({ status: "Delivered" });

    res.json({
      totalOrders,
      pendingOrders,
      shippedOrders,
      deliveredOrders,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// ================= REVENUE LAST 7 DAYS =================
// ================= REVENUE LAST 7 DAYS =================
exports.getWeeklyRevenue = async (req, res) => {
  try {
    const today = new Date();

    // Create UTC end date (today 23:59:59)
    const endDate = new Date(Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate(),
        23, 59, 59, 999
    ));

    // Start date = 6 days before today (7 days total)
    const startDate = new Date(endDate);
    startDate.setUTCDate(endDate.getUTCDate() - 6);
    startDate.setUTCHours(0, 0, 0, 0);

    console.log("==================================");
    console.log("FROM:", startDate);
    console.log("TO  :", endDate);
    console.log("==================================");

    const revenueData = await Order.aggregate([
      {
        $match: {
          status: "Delivered",
          orderDate: {
            $gte: startDate,
            $lte: endDate
          }
        }
      },
      {
        $group: {
          _id: {
            day: { $dayOfWeek: "$orderDate" }
          },
          totalRevenue: { $sum: "$totalPrice" }
        }
      },
      { $sort: { "_id.day": 1 } }
    ]);

    // 🔥 PRINT RESULT
    console.log("AGGREGATION RESULT:");
    console.log(JSON.stringify(revenueData, null, 2));
    console.log("==================================");

    res.json(revenueData);

  } catch (err) {
    console.error("Error in Weekly Revenue:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ================= MONTHLY REVENUE =================
exports.getMonthlyRevenue = async (req, res) => {
  try {
    const year = new Date().getFullYear();

    const revenue = await Order.aggregate([
      {
        $match: {
          orderDate: {
            $gte: new Date(`${year}-01-01`),
            $lte: new Date(`${year}-12-31`),
          },
          status: "Delivered",
        },
      },
      {
        $group: {
          _id: { month: { $month: "$orderDate" } },
          totalRevenue: { $sum: "$totalPrice" },
        },
      },
      { $sort: { "_id.month": 1 } },
    ]);

    res.json(revenue);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// ================= YEARLY REVENUE =================
exports.getYearlyRevenue = async (req, res) => {
  try {
    const revenue = await Order.aggregate([
      {
        $match: { status: "Delivered" },
      },
      {
        $group: {
          _id: { year: { $year: "$orderDate" } },
          totalRevenue: { $sum: "$totalPrice" },
        },
      },
      { $sort: { "_id.year": 1 } },
    ]);

    res.json(revenue);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// ================= TOP SELLING PRODUCTS =================
exports.getTopSellingProducts = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;

    const topProducts = await Order.aggregate([
      { $match: { status: "Delivered" } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.product",
          totalSold: { $sum: "$items.quantity" },
        },
      },
      { $sort: { totalSold: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "productDetails",
        },
      },
      { $unwind: "$productDetails" },
      {
        $project: {
          _id: 0,
          productName: "$productDetails.Title",
          totalSold: 1,
        },
      },
    ]);

    res.json(topProducts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};