const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');

// Import Category and Product models
const Category = require('./category');
const Product = require('./product');

const app = express();
require('dotenv').config();

const coreConfig = {
    origin: "*",
    Credential: true,
    methods: ["GET", "POST", "PUT", "DELETE"]
}

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('Error connecting to MongoDB', err));

app.use(express.json());
app.use(cors());
app.options('*', cors());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const storageEngine = multer.diskStorage({
    destination: "./uploads",
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    },
});

const upload = multer({ storage: storageEngine });


app.post("/single", upload.single("image"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send("Please upload a valid image");
        }

        const { originalname } = req.file;
        const productData = {
            name: req.body.name,
            price: req.body.price,
            brand: req.body.brand,
            category: req.body.category,
            description: req.body.description,
            image: originalname,
        };

        const newProduct = new Product(productData);
        await newProduct.save();
        const presignedPost = await createPresignedPost(productData);
        res.json({ file: req.file, presignedPost });
        res.send("Single file uploaded successfully and product created");
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
});

app.get("/products", async (req, res) => {
    try {
        let query = {};
        if (req.query.category) {
            query.category = req.query.category.trim(); // Filter by category if provided
        }
        if (req.query.brand) {
            query.brand = req.query.brand.trim(); // Filter by brand if provided
        }
        const products = await Product.find(query);
        res.json(products);
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
});

app.get('/', function (req, res) {
    res.send('Hello World')
})

app.get("/products/:productId", async (req, res) => {
    try {
        const productId = req.params.productId;
        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).send("Product not found");
        }

        res.json(product);
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
});

app.put("/products/:productId", async (req, res) => {
    try {
        const productId = req.params.productId;
        const updateData = req.body; // Get the update data from the request body

        const updatedProduct = await Product.findByIdAndUpdate(productId, updateData, { new: true });

        if (!updatedProduct) {
            return res.status(404).send("Product not found");
        }

        res.json(updatedProduct);
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
});

app.get("/products/:categoryId", async (req, res) => {
    try {
        const categoryId = req.params.categoryId;
        const products = await Product.find({ category: categoryId });
        res.json(products);
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
});

app.delete("/delete/:_id", async (req, res) => {
    try {
        const _id = req.params._id;
        const deletedProduct = await Product.deleteOne({ _id });
        if (deletedProduct.deletedCount === 0) {
            return res.status(404).send("Product not found");
        }
        res.send("Product deleted successfully");
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
});

///  this section is add to cart 

// Define a Mongoose schema for the shopping cart items
const ShoppingCartItemSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    quantity: { type: Number, default: 1 }
});

// Create a Mongoose model for the shopping cart items
const ShoppingCartItem = mongoose.model('ShoppingCartItem', ShoppingCartItemSchema);

// Endpoint to add a product to the cart
app.post("/cart/add/:productId", async (req, res) => {
    try {
        const productId = req.params.productId;

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).send("Product not found");
        }

        // Save the product to the shopping cart in the database
        await ShoppingCartItem.create({ productId });

        res.send("Product added to cart successfully");
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
});

// Endpoint to get the shopping cart items
app.get("/cart", async (req, res) => {
    try {
        // Retrieve shopping cart items from the database
        const cartItems = await ShoppingCartItem.find().populate('productId');
        res.json(cartItems);
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
});

// Endpoint to delete a product from the cart
app.delete("/cart/delete/:itemId", async (req, res) => {
    try {
        const itemId = req.params.itemId;

        // Delete the item from the shopping cart in the database
        await ShoppingCartItem.findByIdAndDelete(itemId);

        res.send("Product deleted from cart successfully");
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
});

// Hero image API
const heroStorageEngine = multer.diskStorage({
    destination: "./uploads/hero",
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    },
});

const heroImageSchema = new mongoose.Schema({
    filename: String,
    originalname: String,
});

const HeroImage = mongoose.model('HeroImage', heroImageSchema);

const heroUpload = multer({ storage: heroStorageEngine });

// Endpoint for uploading hero image
app.post("/hero", heroUpload.array("hero-images", 5), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).send("Please upload at least one valid image");
        }

        const heroImages = req.files.map(file => ({
            filename: file.filename,
            originalname: file.originalname
        }));

        const savedImages = await HeroImage.create(heroImages);
        res.send("Hero images uploaded successfully");
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
});

// Endpoint to get all hero images
app.get("/hero", async (req, res) => {
    try {
        const heroImages = await HeroImage.find();
        res.json(heroImages);
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
});

// Endpoint to delete a hero image by filename
app.delete("/hero/:filename", async (req, res) => {
    try {
        const filename = req.params.filename;

        const deletedImage = await HeroImage.findOneAndDelete({ filename });
        if (!deletedImage) {
            return res.status(404).send("Hero image not found");
        }

        res.send("Hero image deleted successfully");
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
});

// Define Mongoose schema for user
const userSchema = new mongoose.Schema({
    id: { type: String, unique: true },
    name: String,
    password: String,
    email: { type: String, unique: true }
});

// Create Mongoose model for user
const User = mongoose.model('User', userSchema);
// Signup route
app.post("/signup", [
    body('id').notEmpty(),
    body('name').notEmpty(),
    body('password').notEmpty(),
    body('email').isEmail()
], async (req, res) => {
    try {
        // Validate inputs
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        // Check if user already exists
        let existingUser = await User.findOne({ $or: [{ id: req.body.id }, { email: req.body.email }] });
        if (existingUser) {
            return res.status(400).json({ msg: "User already exists" });
        }

        // Create new user
        const newUser = new User({
            id: req.body.id,
            name: req.body.name,
            password: req.body.password, // Storing password as plaintext (not recommended)
            email: req.body.email
        });

        await newUser.save();

        res.status(201).json({ msg: "User created successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
});

// Login route
app.post("/login", async (req, res) => {
    try {
        const { id, password } = req.body;

        // Find user by id or email
        const user = await User.findOne({ $or: [{ id }, { email: id }] });
        if (!user) {
            return res.status(400).json({ msg: "Invalid credentials" });
        }

        // Check password
        if (user.password !== password) {
            return res.status(400).json({ msg: "Invalid credentials" });
        }

        res.json({ msg: "Login successful" });
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
});

// Endpoint to get all users
app.get("/users", async (req, res) => {
    try {
        const users = await User.find();
        res.json(users);
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
});

// Rest of your existing endpoints...

app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
});
