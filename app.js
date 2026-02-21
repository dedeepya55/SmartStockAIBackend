var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
require('dotenv').config();
const mongoose = require('mongoose');
const cors = require('cors');


var app = express();

const authRoute = require("./routes/authRoute");
const productRoutes = require('./routes/productRoutes');
const aiChatRoute = require("./routes/aiChatRoute");

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("MongoDB connected"))
.catch(err => console.log(err));

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  credentials: true
}));


app.use("/SMARTSTOCKAI-AI", express.static("SMARTSTOCKAI-AI"));
app.use(
  "/output_results",
  express.static(
    path.join(__dirname, "SMARTSTOCKAI-AI", "output_results")
  )
);

app.use("/api/auth", authRoute);

app.use('/images', express.static('public/images')); 
app.use('/api/products', productRoutes);
app.use("/results", express.static(path.join(__dirname, "SMARTSTOCK_AI2", "results")));

app.use("/uploads", express.static("public/uploads")); 

app.use("/api/ai", aiChatRoute);

// catch 404
app.use(function(req, res, next) {
  if (req.originalUrl.startsWith("/api/")) {
    return res.status(404).json({ message: "API endpoint not found" });
  }
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  if (req.originalUrl.startsWith("/api/")) {
    // Send JSON for API errors
    res.status(err.status || 500).json({ message: err.message });
  } else {
    // Render Pug page for frontend errors
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};
    res.status(err.status || 500);
    res.render('error');
  }
});


module.exports = app;
