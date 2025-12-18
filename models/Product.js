const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  SKU: { type: String, required: true, unique: true },
  Image: { type: String, required: true },        // store image path
  Title: { type: String, required: true },
  Category: { type: String, required: true },
  QTY: { type: Number, required: true },
  Warehouse: { type: String, required: true },   // e.g., "Location A: 5"
  Price: { type: Number, required: true },
  LastModified: { type: Date, required: true }
});

module.exports = mongoose.model('Product', productSchema);
