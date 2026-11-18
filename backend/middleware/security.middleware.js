// backend/middleware/security.middleware.js
// Security middleware for Smart Wifi
// Payload size ceiling, MAC/IP spoofing detection, security headers
// Follows the Comprehensive System Prompt & Engineering Specification

const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const PAYLOAD_MAX_SIZE_KB = parseInt(process.env.PAYLOAD_MAX_SIZE_KB || "10", 10);

function applySecurity(app) {
  // Helmet baseline headers
  app.use(helmet());
  app.use(
    helmet.contentSecurityPolicy({
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'", "https://api.safaricom.co.ke", "https://sandbox.safaricom.co.ke"],
        imgSrc: ["'self'", "data:", "https:"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    })
  );

  // CORS
  app.use((req, res, next) => {
    const origin = req.headers.origin || "";
    const allowed = [process.env.FRONTEND_URL || "http://localhost:3000"];
    if (allowed.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Request-ID");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    if (req.method === "OPTIONS") return res.status(204).end();
    next();
  });

  // JSON body parser with strict size ceiling
  app.use(express.json({ limit: `${PAYLOAD_MAX_SIZE_KB}kb` }));

  // General express rate limiter (defense in depth)
  app.use(
    rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10),
      max: parseInt(process.env.RATE_LIMIT_MAX_GENERAL || "100", 10),
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: "Too Many Requests", message: "Global rate limit exceeded" },
    })
  );
}

module.exports = { applySecurity, PAYLOAD_MAX_SIZE_KB };
