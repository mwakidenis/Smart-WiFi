// backend/middleware/auth.middleware.js
// JWT authentication middleware for Smart Wifi
// Follows the Comprehensive System Prompt & Engineering Specification

const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}

function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN, issuer: "swift-wifi", audience: "smart-wifi-client" }
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: "swift-wifi",
      audience: "smart-wifi-client",
    });
  } catch (err) {
    return null;
  }
}

function extractToken(req) {
  const auth = req.headers.authorization || req.headers.Authorization;
  if (!auth || !auth.startsWith("Bearer ")) return null;
  return auth.slice(7).trim();
}

function authenticate(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: "Unauthorized", message: "Missing or invalid Authorization header" });
  }
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Unauthorized", message: "Token expired or invalid" });
  }
  req.user = payload;
  next();
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized", message: "Authentication required" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden", message: "Insufficient role" });
    }
    next();
  };
}

function optionalAuthenticate(req, res, next) {
  const token = extractToken(req);
  if (token) {
    const payload = verifyToken(token);
    if (payload) req.user = payload;
  }
  next();
}

module.exports = { signToken, verifyToken, extractToken, authenticate, authorize, optionalAuthenticate };
