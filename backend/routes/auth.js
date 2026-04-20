const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { hashToken } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'shetrust_dev_secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30d';

// Strict rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10,
  message: { success: false, error: 'Too many auth attempts. Please try again in 15 minutes.' },
});

function signToken(userId) {
  return jwt.sign({ userId, iat: Date.now() }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function sendAuth(res, user, statusCode = 200) {
  const token = signToken(user._id);
  res.status(statusCode).json({
    success: true,
    token,
    user: user.toSafeObject(),
  });
}

// ── POST /api/auth/signup ────────────────────────────────────────────
router.post('/signup', authLimiter, async (req, res) => {
  try {
    const { name, email, password, anonToken } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Name, email and password are required.' });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ success: false, error: 'An account with this email already exists.' });
    }

    const userData = { name: name.trim(), email: email.toLowerCase().trim(), password };

    // Link prior anon ratings to this account
    if (anonToken) {
      userData.anonTokenHash = hashToken(anonToken);
    }

    const user = await User.create(userData);
    sendAuth(res, user, 201);
  } catch (err) {
    if (err.name === 'ValidationError') {
      const msg = Object.values(err.errors).map(e => e.message).join(', ');
      return res.status(400).json({ success: false, error: msg });
    }
    console.error('Signup error:', err);
    res.status(500).json({ success: false, error: 'Server error during signup.' });
  }
});

// ── POST /api/auth/login ─────────────────────────────────────────────
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    sendAuth(res, user);
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Server error during login.' });
  }
});

// ── GET /api/auth/me ─────────────────────────────────────────────────
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ success: false, error: 'Not authenticated.' });

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ success: false, error: 'Invalid or expired token.' });
    }

    if (!decoded.userId) return res.status(401).json({ success: false, error: 'Not a user token.' });

    const user = await User.findById(decoded.userId);
    if (!user) return res.status(404).json({ success: false, error: 'User not found.' });

    res.json({ success: true, user: user.toSafeObject() });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

// ── POST /api/auth/logout ────────────────────────────────────────────
// Stateless JWT — client just drops the token. This endpoint is a no-op
// but included for a clean API contract.
router.post('/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out successfully.' });
});

module.exports = router;
