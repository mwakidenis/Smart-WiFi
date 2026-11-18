// backend/middleware/ddos.middleware.js
// DDoS protection middleware for Smart Wifi
// Sliding-window rate limiting per route tier
// Follows the Comprehensive System Prompt & Engineering Specification

const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10); // 15 minutes
const MAX_AUTH = parseInt(process.env.RATE_LIMIT_MAX_AUTH || "10", 10);
const MAX_PAYMENT = parseInt(process.env.RATE_LIMIT_MAX_PAYMENT || "20", 10);
const MAX_GENERAL = parseInt(process.env.RATE_LIMIT_MAX_GENERAL || "100", 10);

// In-memory sliding-window rate limit records keyed by ip:route
const records = new Map();

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const first = String(forwarded).split(",")[0].trim();
    if (first) return first;
  }
  const realIp = req.headers["x-real-ip"];
  if (realIp) return String(realIp).trim();
  return req.socket.remoteAddress || req.ip || "unknown";
}

function checkLimit(key, max, windowMs) {
  const now = Date.now();
  const windowStart = now - windowMs;
  let record = records.get(key);
  if (!record || record.windowStart < windowStart) {
    record = { count: 0, windowStart: now };
    records.set(key, record);
  }
  record.count += 1;
  const remaining = Math.max(0, max - record.count);
  const resetAt = record.windowStart + windowMs;
  const allowed = record.count <= max;
  return { allowed, remaining, resetAt, retryAfter: allowed ? 0 : Math.max(0, resetAt - now) };
}

function tierForPath(path) {
  if (path.startsWith("/api/auth")) return { max: MAX_AUTH, label: "auth" };
  if (path.startsWith("/api/mpesa") || path.startsWith("/api/payments")) return { max: MAX_PAYMENT, label: "payment" };
  return { max: MAX_GENERAL, label: "general" };
}

function ddosMiddleware(req, res, next) {
  const ip = getClientIp(req);
  const path = req.path || "/";
  const tier = tierForPath(path);

  const key = `${ip}:${path}`;
  const result = checkLimit(key, tier.max, WINDOW_MS);

  res.setHeader("X-RateLimit-Limit", tier.max);
  res.setHeader("X-RateLimit-Remaining", result.remaining);
  res.setHeader("X-RateLimit-Reset", Math.ceil(result.resetAt / 1000));

  if (!result.allowed) {
    return res.status(429).json({
      error: "Too Many Requests",
      message: "Rate limit exceeded. Try again later.",
      retryAfter: Math.ceil(result.retryAfter / 1000),
    });
  }

  next();
}

module.exports = { ddosMiddleware, getClientIp, checkLimit, WINDOW_MS, MAX_AUTH, MAX_PAYMENT, MAX_GENERAL };
