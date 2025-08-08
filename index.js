require("dotenv").config();

const express = require("express");
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS before any other middleware or routes
const cors = require('cors');

const allowedOrigins = [
  'http://localhost:3000',
  'https://jmgbqbmh-5000.inc1.devtunnels.ms',
  'https://jmgbqbhm-3000.inc1.devtunnels.ms' // <-- add this line
];
app.use(cors({
  origin: function(origin, callback) {
    // allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
}));

// Supabase client initialization
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
app.set('supabase', supabase);

// Middleware to parse JSON and URL-encoded data with increased size limit
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Simple health check route
app.get('/ping', (req, res) => {
  res.json({ status: 'ok', message: 'pong' });
});

// CORS test route (must be before authentication middleware)
const corsTestRoutes = require("./routes/cors-test");
app.use("/cors", corsTestRoutes);

// Authentication middleware
const authUser = require('./middleware/authUser');
app.use(authUser);

const userRoutes = require("./routes/user");
app.use("/users", userRoutes);

const deviceRoutes = require("./routes/device");
app.use("/device", deviceRoutes);

const adminRoutes = require("./routes/admin");
app.use("/admin", adminRoutes);

const leaveRoutes = require("./routes/leave");
app.use("/leave", leaveRoutes);

const notificationRoutes = require("./routes/notification");
app.use("/notification", notificationRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
