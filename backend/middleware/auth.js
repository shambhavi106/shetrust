const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'shetrust_dev_secret';

/**
 * Generate an anonymous token for a new visitor.
 * Returns { token, tokenHash }
 */
function generateAnonToken() {
  const payload = { anon: true, iat: Date.now() };
  const token = jwt.sign(payload, JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d'
  });
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, tokenHash };
}

/**
 * Middleware: attach user identity to req.
 * If no token → auto-issue one (anonymous participation).
 * If token invalid → issue new one.
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.userToken = crypto.createHash('sha256').update(token).digest('hex');
      req.tokenDecoded = decoded;
      return next();
    } catch (err) {
      // Token invalid/expired — issue fresh one
    }
  }

  // Issue a new anon token
  const { token: newToken, tokenHash } = generateAnonToken();
  res.setHeader('X-Auth-Token', newToken); // client should save this
  req.userToken = tokenHash;
  req.isNewToken = true;
  next();
}

/**
 * Hash a token for storage comparison (never store raw tokens)
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = { generateAnonToken, authMiddleware, hashToken };
