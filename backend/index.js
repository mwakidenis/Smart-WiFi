// backend/index.js
// Smart Wifi Hotspot Billing & M-Pesa Integration API
// Follows the Comprehensive System Prompt & Engineering Specification

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const { v4: uuidv4 } = require("uuid");
const os = require("os");
const rateLimit = require("express-rate-limit");

// Config
const { validateEnv } = require("./config/env");
const prisma = require("./config/database");

// Middleware
const { ddosMiddleware, getClientIp } = require("./middleware/ddos.middleware");
const { applySecurity } = require("./middleware/security.middleware");
const { authenticate, authorize } = require("./middleware/auth.middleware");
const errorHandler = require("./middleware/errorHandler");

// Services
const billingService = require("./services/billingService");
const mikrotikService = require("./services/mikrotikService");

const app = express();
app.use(cors());
app.use(express.json());
app.use(cookieParser());

// Validate environment at startup
validateEnv();

// Baseline security stack
applySecurity(app);

// Health
app.get("/", (_req, res) => {
  res.json({ service: "Smart Wifi API", status: "online", frontend: "http://localhost:3000" });
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "smart-wifi-api" });
});

// Uptime / connection status
app.get("/api/uptime", async (_req, res) => {
  const uptimeMs = Date.now() - serverStartTime;
  const uptimeSeconds = Math.floor(uptimeMs / 1000);
  const uptimeMinutes = Math.floor(uptimeSeconds / 60);
  const uptimeHours = Math.floor(uptimeMinutes / 60);

  const interfaces = os.networkInterfaces();
  let macAddress = "—";
  for (const iface of Object.values(interfaces)) {
    if (iface) {
      for (const addr of iface) {
        if (addr.family === "IPv4" && !addr.internal && addr.mac !== "00:00:00:00:00:00") {
          macAddress = addr.mac;
          break;
        }
      }
      if (macAddress !== "—") break;
    }
  }

  res.json({
    uptime: `${uptimeHours}h ${uptimeMinutes % 60}m ${uptimeSeconds % 60}s`,
    uptimeSeconds,
    status: "online",
    macAddress,
    serverTime: new Date().toISOString(),
    platform: process.platform,
    nodeVersion: process.version,
  });
});

// ============ AUTH ROUTES ============

app.post("/api/auth/register", async (req, res) => {
  const { email, phone, password, name } = req.body;
  if (!email || !phone || !password) {
    return res.status(400).json({ error: "email, phone, password required" });
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { phone }] },
  });
  if (existing) {
    return res.status(409).json({ error: "Email or phone already registered" });
  }

  const user = await prisma.user.create({
    data: { email, phone, password, name, role: "CUSTOMER" },
  });

  res.json({ message: "Registered", user: { id: user.id, email: user.email, phone: user.phone, name: user.name, balance: user.balance } });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, phone, password } = req.body;
  const user = await prisma.user.findFirst({
    where: { OR: [{ email }, { phone }] },
  });
  if (!user || user.password !== password) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  if (!user.isActive) {
    return res.status(403).json({ error: "Account is inactive" });
  }

  const token = jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d", issuer: "smart-wifi", audience: "smart-wifi-client" }
  );

  res.json({ message: "Logged in", token, user: { id: user.id, email: user.email, phone: user.phone, name: user.name, balance: user.balance } });
});

app.get("/api/auth/me", authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user: { id: user.id, email: user.email, phone: user.phone, name: user.name, role: user.role, balance: user.balance } });
});

// ============ PACKAGES ============

app.get("/api/packages", (_req, res) => {
  res.json({ packages });
});

// ============ MPESA STK PUSH ============

app.post("/api/mpesa/stk-push", authenticate, ddosMiddleware, async (req, res) => {
  try {
    const { phone, amount, packageId } = req.body;
    if (!phone || !amount) {
      return res.status(400).json({ error: "phone and amount required" });
    }
    const amt = Math.round(Number(amount));
    if (!amt || amt <= 0) {
      return res.status(400).json({ error: "amount must be a positive whole number" });
    }

    const result = await billingService.initiateStkPush({
      phoneNumber: phone,
      amount: amt,
      packageId,
      userId: req.user.sub,
    });

    res.json({
      message: "STK Push sent to your phone",
      checkoutRequestID: result.checkoutRequestID,
      merchantRequestID: result.merchantRequestID,
      transactionId: result.transactionId,
      customerMessage: result.customerMessage,
      responseCode: result.responseCode,
    });
  } catch (err) {
    console.error("[stk-push error]", err.message);
    res.status(500).json({ error: "STK Push failed", message: err.message });
  }
});

// M-Pesa callback (idempotent)
app.post("/api/mpesa/callback", ddosMiddleware, express.json({ limit: "10kb" }), async (req, res) => {
  // Acknowledge FIRST — before any DB work — so Safaricom does not retry.
  res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });

  setImmediate(async () => {
    try {
      const result = await billingService.processCallback(req.body);
      if (result.success) {
        console.log("[callback] PAID:", result.transaction?.id || "already processed");
      } else {
        console.error("[callback] Error:", result.error);
      }
    } catch (err) {
      console.error("[callback processing error]", err.message);
    }
  });
});

// Time remaining for active package (by phone)
app.get("/api/time-remaining", authenticate, async (req, res) => {
  const { phone } = req.query;
  if (!phone) return res.status(400).json({ error: "phone required" });
  const norm = normalizePhone(phone);

  const interfaces = os.networkInterfaces();
  let macAddress = "—";
  for (const iface of Object.values(interfaces)) {
    if (iface) {
      for (const addr of iface) {
        if (addr.family === "IPv4" && !addr.internal && addr.mac !== "00:00:00:00:00:00") {
          macAddress = addr.mac;
          break;
        }
      }
      if (macAddress !== "—") break;
    }
  }

  const txs = await prisma.transaction.findMany({
    where: { phone: norm, status: "COMPLETED", expiresAt: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 1,
  });

  if (txs.length === 0) {
    return res.json({ remainingMs: 0, remaining: "0m 0s", expired: true, package: null, macAddress });
  }

  const tx = txs[0];
  const now = Date.now();
  const remainingMs = Math.max(0, new Date(tx.expiresAt).getTime() - now);
  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  res.json({
    remainingMs,
    remaining: `${minutes}m ${seconds}s`,
    expired: remainingMs <= 0,
    package: tx.package,
    packageId: tx.packageId,
    durationMin: tx.durationMin,
    expiresAt: tx.expiresAt,
    macAddress,
  });
});

// ============ SUPPORT ============

app.post("/api/support", authenticate, ddosMiddleware, async (req, res) => {
  const { phone, transactionCode, message } = req.body;
  if (!phone || !message) {
    return res.status(400).json({ error: "phone and message required" });
  }

  const supportMsg = await prisma.auditLog.create({
    data: {
      userId: req.user.sub,
      action: "SUPPORT_REQUEST",
      entity: "Support",
      metadata: { phone, transactionCode, message },
    },
  });

  res.json({ message: "Support message sent successfully", id: supportMsg.id });
});

app.get("/api/support", authenticate, authorize("ADMIN"), async (req, res) => {
  const messages = await prisma.auditLog.findMany({
    where: { action: "SUPPORT_REQUEST" },
    orderBy: { createdAt: "desc" },
  });
  res.json({ supportMessages: messages });
});

// ============ TRANSACTIONS ============

app.get("/api/transactions", authenticate, async (req, res) => {
  const transactions = await prisma.transaction.findMany({
    where: { userId: req.user.sub },
    orderBy: { createdAt: "desc" },
    include: { package: true },
  });
  res.json({ transactions });
});

// ============ ADMIN ROUTES ============

app.get("/api/admin/router-health", authenticate, authorize("ADMIN"), async (_req, res) => {
  try {
    const health = await mikrotikService.getRouterHealth();
    res.json({ routerHealth: health });
  } catch (err) {
    res.status(502).json({ error: "Bad Gateway", message: err.message });
  }
});

app.post("/api/admin/provision-mac", authenticate, authorize("ADMIN"), async (req, res) => {
  const { macAddress, comment } = req.body;
  if (!macAddress) {
    return res.status(400).json({ error: "macAddress required" });
  }
  try {
    const result = await mikrotikService.whitelistMacAddress(macAddress, comment || "Paid via M-Pesa");
    res.json({ message: "MAC whitelisted", ...result });
  } catch (err) {
    res.status(502).json({ error: "Bad Gateway", message: err.message });
  }
});

// Global error handler
app.use(errorHandler);

const serverStartTime = Date.now();
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Smart Wifi API listening on http://localhost:${PORT}`);
  console.log(`  Environment: ${process.env.MPESA_ENVIRONMENT || "sandbox"}`);
  console.log(`  Shortcode: ${process.env.MPESA_SHORTCODE || "174379 (sandbox default)"}`);
});
