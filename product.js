// models/Product.js

const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: String,
    price: Number,
    brand: String,
    category: String,
    image: String,
    description:String,
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
