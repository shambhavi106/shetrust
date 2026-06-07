const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const JWT_SECRET = process.env.JWT_SECRET || 'shetrust_dev_secret';

/** Hash a token (anon or JWT) for safe DB storage. */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Auth middleware — supports both:
 *   1. Anonymous users: sets req.userToken from stored anon JWT
 *   2. Registered users: verifies JWT, sets req.userId + req.userToken
 * Always ensures req.userToken is set (issues new anon token if needed).
 */
async function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.userId) {
        req.userId    = decoded.userId;
        req.userToken = hashToken(token);
        req.isNewToken = false;

        // Attach user role for admin checks
        try {
          const User = require('../models/User');
          const user = await User.findById(decoded.userId).select('role').lean();
          req.userRole = user?.role || 'user';
        } catch (_) { req.userRole = 'user'; }

        return next();
      }
      // Anon JWT (has anonId field)
      if (decoded.anonId) {
        req.userToken  = hashToken(token);
        req.isNewToken = false;
        req.userRole   = 'user';
        return next();
      }
    } catch (err) {
      // Expired / invalid — fall through to issue new token
    }
  }

  // Issue new anonymous token
  const anonId   = uuidv4();
  const newToken = jwt.sign({ anonId }, JWT_SECRET, { expiresIn: '90d' });
  res.setHeader('X-Auth-Token', newToken);
  req.userToken  = hashToken(newToken);
  req.isNewToken = true;
  req.userRole   = 'user';
  next();
}

/**
 * Role guard middleware — use AFTER authMiddleware.
 * requireRole('moderator', 'admin') allows both roles.
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.userId) {
      return res.status(401).json({ success: false, error: 'Login required for this action.' });
    }
    if (!roles.includes(req.userRole)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions.' });
    }
    next();
  };
}

module.exports = { authMiddleware, requireRole, hashToken };
