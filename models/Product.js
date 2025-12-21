const mongoose = require("mongoose");

const stockMovementSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
    },
    qty: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    SKU: { type: String, required: true, unique: true },

    Image: { type: String, required: true },

    Title: { type: String, required: true },

    Category: { type: String, required: true },

    QTY: { type: Number, required: true },

    Warehouse: { type: String, required: true },

    Price: { type: Number, required: true },

    LastModified: {
      type: Date,
      default: Date.now,
    },

    inDates: {
      type: [stockMovementSchema], // array of in-stock entries
      default: [],
    },

    outDates: {
      type: [stockMovementSchema], // array of out-stock entries
      default: [],
    },

    minStock: {
      type: Number,
      required: true,
      default: 0,
    },

    maxStock: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
