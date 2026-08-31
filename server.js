const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const db = require('./db');
const { verifyAdminToken, requireOwner } = require('./middleware');

const app = express();
app.use(express.json());
app.use(cors());

// --- AUTH ROUTE ---
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const [rows] = await db.query('SELECT * FROM admins WHERE username = ?', [username]);
    if (rows.length === 0) return res.status(401).json({ error: 'Invalid username or password' });

    const admin = rows[0];
    const validPassword = await bcrypt.compare(password, admin.password_hash);
    if (!validPassword) return res.status(401).json({ error: 'Invalid username or password' });

    const token = jwt.sign(
      { id: admin.id, username: admin.username, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({ message: 'Login successful', token, role: admin.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// --- ANALYTICS OVERVIEW ROUTE (Protected) ---
app.get('/api/admin/overview', verifyAdminToken, async (req, res) => {
  try {
    const [pendingOrders] = await db.query("SELECT COUNT(*) as count FROM orders WHERE status = 'pending'");
    const [totalRev] = await db.query("SELECT SUM(price_egp) as revenue FROM orders WHERE status = 'completed'");
    const [activeProducts] = await db.query("SELECT COUNT(*) as count FROM products WHERE is_active = TRUE");

    res.json({
      pendingTickets: pendingOrders[0].count || 0,
      totalRevenueEGP: totalRev[0].revenue || 0,
      activeProductsCount: activeProducts[0].count || 0,
      loggedInUser: req.user.username,
      role: req.user.role
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load analytics overview' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`GameNest Admin Server running on port ${PORT}`);
});
