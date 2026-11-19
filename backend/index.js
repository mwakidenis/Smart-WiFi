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
const { z } = require("zod");

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

function normalizePhone(phone) {
  const digits = String(phone).replace(/\D/g, "");
  return digits.startsWith("0") ? `254${digits.slice(1)}` : digits.startsWith("254") ? digits : `254${digits}`;
}

const stkPushSchema = z.object({
  phone: z.string().min(9).max(15),
  amount: z.coerce.number().int().positive(),
  packageId: z.string().min(1),
  macAddress: z.string().optional(),
});

const restoreSessionSchema = z.object({
  phone: z.string().min(9).max(15).optional(),
  mpesaReceiptNumber: z.string().min(4).max(30).optional(),
  macAddress: z.string().min(12),
}).refine((value) => Boolean(value.phone || value.mpesaReceiptNumber), { message: "phone or receipt required" });

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

const defaultPackages = [
  { id: "pkg_1", name: "1 Hour", dataLimitMB: 500, durationMin: 60, price: 10, currency: "KES", description: "1 hour capped bundle", speedMbps: 5, maxDevices: 1 },
  { id: "pkg_2", name: "12 Hours 1 Device", dataLimitMB: null, durationMin: 720, price: 15, currency: "KES", description: "12 hours unlimited for 1 device", speedMbps: 10, maxDevices: 1 },
  { id: "pkg_3", name: "12 Hours 2 Devices", dataLimitMB: null, durationMin: 720, price: 25, currency: "KES", description: "12 hours unlimited for 2 devices", speedMbps: 10, maxDevices: 2 },
  { id: "pkg_4", name: "24 Hours 1 Device", dataLimitMB: null, durationMin: 1440, price: 30, currency: "KES", description: "24 hours unlimited for 1 device", speedMbps: 15, maxDevices: 1 },
  { id: "pkg_5", name: "2 Weeks 1 Device", dataLimitMB: null, durationMin: 20160, price: 450, currency: "KES", description: "2 weeks unlimited for 1 device", speedMbps: 15, maxDevices: 1 },
  { id: "pkg_6", name: "1 Month 1 Device", dataLimitMB: null, durationMin: 43200, price: 750, currency: "KES", description: "1 month unlimited for 1 device", speedMbps: 25, maxDevices: 1 },
];

app.get("/api/packages", async (_req, res) => {
  try {
    const packages = await prisma.package.findMany({ where: { isActive: true }, orderBy: { price: "asc" } });
    res.json({ packages: packages.map((pkg) => ({ ...pkg, dataLimitMB: pkg.dataLimitMB ?? pkg.dataMb ?? null, maxDevices: pkg.maxDevices || 1 })) });
  } catch (_error) {
    res.json({ packages: defaultPackages });
  }
});

// ============ CAPTIVE PORTAL SESSION ============

app.get("/api/session/status", async (req, res) => {
  const macAddress = String(req.query.macAddress || "").trim().toUpperCase();
  const ipAddress = String(req.query.ipAddress || "").trim() || null;
  if (!macAddress) {
    return res.json({ state: "DISCONNECTED", expiresAt: null, serverTime: new Date().toISOString(), speedMbps: 0, activeDevices: 0, maxDevices: 1, macAddress: null, ipAddress });
  }

  try {
    const session = await prisma.activeSession.findFirst({
      where: { macAddress, status: "ACTIVE" },
      include: { package: true },
      orderBy: { expiresAt: "desc" },
    });
    const now = new Date();
    if (!session) {
      return res.json({ state: "DISCONNECTED", expiresAt: null, serverTime: now.toISOString(), speedMbps: 0, activeDevices: 0, maxDevices: 1, macAddress, ipAddress });
    }
    const expired = session.expiresAt <= now;
    if (expired) {
      await prisma.activeSession.update({ where: { id: session.id }, data: { status: "EXPIRED" } });
    }
    const activeDevices = await prisma.activeSession.count({ where: { packageId: session.packageId, status: "ACTIVE", expiresAt: { gt: now } } });
    return res.json({ state: expired ? "EXPIRED" : "ONLINE", expiresAt: session.expiresAt.toISOString(), serverTime: now.toISOString(), speedMbps: session.package.speedMbps, activeDevices, maxDevices: session.package.maxDevices, macAddress, ipAddress: session.ipAddress || ipAddress });
  } catch (error) {
    console.error("[session status]", error.message);
    return res.status(503).json({ error: "Session status unavailable" });
  }
});

app.post("/api/session/restore", async (req, res) => {
  const parsed = restoreSessionSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: "Invalid restore request", details: parsed.error.flatten() });
  const { phone, mpesaReceiptNumber, macAddress } = parsed.data;
  const transaction = await prisma.transaction.findFirst({ where: { status: "COMPLETED", ...(mpesaReceiptNumber ? { mpesaReceipt: mpesaReceiptNumber } : { phone }), expiresAt: { gt: new Date() } }, include: { package: true }, orderBy: { expiresAt: "desc" } });
  if (!transaction || !transaction.packageId || !transaction.expiresAt) return res.status(404).json({ error: "No active package found" });
  const session = await prisma.activeSession.upsert({ where: { packageId_macAddress: { packageId: transaction.packageId, macAddress: macAddress.toUpperCase() } }, update: { expiresAt: transaction.expiresAt, status: "ACTIVE", lastSeenAt: new Date() }, create: { packageId: transaction.packageId, userId: transaction.userId, macAddress: macAddress.toUpperCase(), expiresAt: transaction.expiresAt } });
  res.json({ message: "Session restored", sessionId: session.id, expiresAt: session.expiresAt });
});

// ============ MPESA STK PUSH ============

app.post("/api/mpesa/stk-push", authenticate, ddosMiddleware, async (req, res) => {
  try {
    const parsed = stkPushSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: "Invalid STK request", details: parsed.error.flatten() });
    const { phone, amount, packageId, macAddress } = parsed.data;
    const amt = amount;

    const result = await billingService.initiateStkPush({
      phoneNumber: phone,
      amount: amt,
      packageId,
      userId: req.user.sub,
      macAddress,
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

app.get("/api/mpesa/status/:checkoutRequestId", async (req, res) => {
  const transaction = await prisma.transaction.findUnique({ where: { checkoutRequestId: req.params.checkoutRequestId }, select: { status: true, mpesaReceipt: true, expiresAt: true } });
  if (!transaction) return res.status(404).json({ error: "Payment not found" });
  res.json(transaction);
});

app.get("/api/mpesa/status/:checkoutRequestId/events", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  const checkoutRequestId = req.params.checkoutRequestId;
  const timer = setInterval(async () => {
    const transaction = await prisma.transaction.findUnique({ where: { checkoutRequestId }, select: { status: true, mpesaReceipt: true, expiresAt: true } });
    if (!transaction) return;
    res.write(`data: ${JSON.stringify(transaction)}\n\n`);
    if (transaction.status !== "PENDING") { clearInterval(timer); res.end(); }
  }, 1000);
  req.on("close", () => clearInterval(timer));
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
