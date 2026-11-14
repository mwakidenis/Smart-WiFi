const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const os = require('os');
const { stkPush, parseStkCallback, normalizePhone } = require('./services/mpesa');

const app = express();
app.use(cors());
app.use(express.json());

// In-memory storage
const users = [];
const packages = [];
const transactions = [];

// Server start time for uptime calculation
const serverStartTime = Date.now();

// Seed default packages — time-based with different speeds
packages.push(
  { id: uuidv4(), name: '1 Hour', speedMbps: 5, durationMin: 60, price: 10, currency: 'KES', description: '1 hour unlimited for 1 device' },
  { id: uuidv4(), name: '12 Hours 1 Device', speedMbps: 10, durationMin: 720, price: 15, currency: 'KES', description: '12 hours unlimited for 1 device' },
  { id: uuidv4(), name: '12 Hours 2 Devices', speedMbps: 10, durationMin: 720, price: 25, currency: 'KES', description: '12 hours unlimited for 2 devices' },
  { id: uuidv4(), name: '24 Hours 1 Device', speedMbps: 15, durationMin: 1440, price: 30, currency: 'KES', description: '24 hours unlimited for 1 device' },
  { id: uuidv4(), name: '2 Weeks 1 Device', speedMbps: 15, durationMin: 20160, price: 450, currency: 'KES', description: '2 weeks unlimited for 1 device' },
  { id: uuidv4(), name: '1 Month 1 Device', speedMbps: 25, durationMin: 43200, price: 750, currency: 'KES', description: '1 month unlimited for 1 device' }
);

// Seed default user (regular customer)
users.push({
  id: uuidv4(),
  email: 'user@swiftwifi.local',
  phone: '0700000000',
  password: 'user',
  name: 'Customer',
  balance: 0,
  role: 'CUSTOMER',
  createdAt: new Date()
});

// Health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'swift-wifi-api' });
});

// Uptime / connection status
app.get('/api/uptime', (req, res) => {
  const uptimeMs = Date.now() - serverStartTime;
  const uptimeSeconds = Math.floor(uptimeMs / 1000);
  const uptimeMinutes = Math.floor(uptimeSeconds / 60);
  const uptimeHours = Math.floor(uptimeMinutes / 60);

  // Get MAC address from network interfaces (real hardware address)
  const interfaces = os.networkInterfaces();
  let macAddress = '—';
  for (const iface of Object.values(interfaces)) {
    if (iface) {
      for (const addr of iface) {
        if (addr.family === 'IPv4' && !addr.internal && addr.mac !== '00:00:00:00:00:00') {
          macAddress = addr.mac;
          break;
        }
      }
      if (macAddress !== '—') break;
    }
  }

  res.json({
    uptime: `${uptimeHours}h ${uptimeMinutes % 60}m ${uptimeSeconds % 60}s`,
    uptimeSeconds,
    status: 'online',
    macAddress,
    serverTime: new Date().toISOString(),
    platform: process.platform,
    nodeVersion: process.version
  });
});

// Register
app.post('/api/auth/register', (req, res) => {
  const { email, phone, password, name } = req.body;
  if (!email || !phone || !password) {
    return res.status(400).json({ error: 'email, phone, password required' });
  }
  if (users.find(u => u.email === email || u.phone === phone)) {
    return res.status(409).json({ error: 'User already exists' });
  }
  const user = { id: uuidv4(), email, phone, password, name, balance: 0, role: 'CUSTOMER', createdAt: new Date() };
  users.push(user);
  res.json({ message: 'Registered', user: { id: user.id, email: user.email, phone: user.phone, name: user.name, balance: user.balance } });
});

// Login
app.post('/api/auth/login', (req, res) => {
  const { email, phone, password } = req.body;
  const user = users.find(u => (u.email === email || u.phone === phone) && u.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  res.json({ message: 'Logged in', token: 'dev-token-' + user.id, user: { id: user.id, email: user.email, phone: user.phone, name: user.name, balance: user.balance } });
});

// Get profile
app.get('/api/auth/me', (req, res) => {
  const token = req.headers.authorization;
  if (!token || !token.startsWith('dev-token-')) return res.status(401).json({ error: 'Unauthorized' });
  const id = token.replace('dev-token-', '');
  const user = users.find(u => u.id === id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: { id: user.id, email: user.email, phone: user.phone, name: user.name, balance: user.balance } });
});

// Get packages (time-based, speed-based)
app.get('/api/packages', (req, res) => {
  res.json({ packages });
});

// POST /api/mpesa/stk-push — initiate real Daraja STK Push
app.post('/api/mpesa/stk-push', async (req, res) => {
  try {
    const { phone, amount, packageId } = req.body;
    if (!phone || !amount) {
      return res.status(400).json({ error: 'phone and amount required' });
    }
    const amt = Math.round(Number(amount));
    if (!amt || amt <= 0) {
      return res.status(400).json({ error: 'amount must be a positive whole number' });
    }

    const pkg = packages.find(p => p.name === packageId || p.id === packageId);
    const phoneNorm = normalizePhone(phone);

    // Idempotency key for this checkout attempt
    const checkoutRequestId = 'swift_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

    // Create PENDING transaction BEFORE calling Daraja (so callback can match it)
    const tx = {
      id: uuidv4(),
      phone: phoneNorm,
      amount: amt,
      package: pkg ? pkg.name : 'Custom',
      packageId: pkg ? pkg.id : null,
      durationMin: pkg ? pkg.durationMin : null,
      status: 'PENDING',
      checkoutRequestId,
      mpesaReceipt: null,
      createdAt: new Date()
    };
    transactions.push(tx);

    // Initiate STK Push via Daraja
    const result = await stkPush({
      phone: phoneNorm,
      amount: amt,
      accountReference: 'SwiftWiFi',
      transactionDesc: pkg ? 'Wi-Fi Bundle: ' + pkg.name : 'Wi-Fi Top-up',
      checkoutRequestId
    });

    res.json({
      message: 'STK Push sent to your phone',
      checkoutRequestID: result.CheckoutRequestID,
      merchantRequestID: result.MerchantRequestID,
      transactionId: tx.id,
      customerMessage: result.CustomerMessage,
      responseCode: result.ResponseCode
    });
  } catch (err) {
    console.error('[stk-push error]', err.message);
    res.status(500).json({ error: 'STK Push failed', message: err.message });
  }
});

// POST /api/mpesa/callback — Safaricom Daraja callback (idempotent)
// Always responds 200 quickly so Safaricom does not retry.
app.post('/api/mpesa/callback', (req, res) => {
  // Acknowledge FIRST — before any DB work — so Safaricom does not retry.
  res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });

  // Process asynchronously after the response is sent.
  setImmediate(() => {
    try {
      const parsed = parseStkCallback(req.body);
      if (!parsed) {
        console.error('[callback] Unparseable callback body');
        return;
      }

      const { checkoutRequestID, resultCode, resultDesc, amount, receipt, phone, success } = parsed;

      // Idempotency: find the transaction by CheckoutRequestID.
      const txIndex = transactions.findIndex(t => t.checkoutRequestId === checkoutRequestID);
      if (txIndex === -1) {
        console.error('[callback] Unknown CheckoutRequestID:', checkoutRequestID);
        return;
      }

      const tx = transactions[txIndex];

      // If already finalised, ignore (duplicate callback).
      if (tx.status !== 'PENDING') {
        console.log('[callback] Duplicate callback for', checkoutRequestID, 'status already:', tx.status);
        return;
      }

      if (success) {
        // Mark completed + credit user balance
        tx.status = 'COMPLETED';
        tx.mpesaReceipt = receipt;
        tx.amount = amount;
        tx.completedAt = new Date();
        tx.expiresAt = tx.durationMin
          ? new Date(tx.completedAt.getTime() + tx.durationMin * 60 * 1000)
          : null;
        const user = users.find(u => u.phone === phone);
        if (user) user.balance = (user.balance || 0) + amount;
        console.log('[callback] PAID', checkoutRequestID, 'KES', amount, 'receipt:', receipt);
      } else {
        // Failed / cancelled / timeout
        tx.status = 'FAILED';
        tx.failureReason = resultDesc;
        tx.completedAt = new Date();
        console.log('[callback] FAILED', checkoutRequestID, resultCode, resultDesc);
      }
    } catch (err) {
      console.error('[callback processing error]', err.message);
    }
  });
});

// Time remaining for active package (by phone)
app.get('/api/time-remaining', (req, res) => {
  const { phone } = req.query;
  if (!phone) return res.status(400).json({ error: 'phone required' });
  const norm = normalizePhone(phone);

  // Find the most recent COMPLETED transaction for this phone
  const txs = transactions.filter(t => t.phone === norm && t.status === 'COMPLETED' && t.expiresAt);
  if (txs.length === 0) {
    return res.json({ remainingMs: 0, remaining: '0m 0s', expired: true, package: null });
  }

  const tx = txs[txs.length - 1];
  const now = Date.now();
  const remainingMs = Math.max(0, new Date(tx.expiresAt).getTime() - now);
  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  res.json({
    remainingMs,
    remaining: minutes + 'm ' + seconds + 's',
    expired: remainingMs <= 0,
    package: tx.package,
    packageId: tx.packageId,
    durationMin: tx.durationMin,
    expiresAt: tx.expiresAt
  });
});

// Support messages storage
const supportMessages = [];

// Submit support message
app.post('/api/support', (req, res) => {
  const { phone, transactionCode, message } = req.body;
  if (!phone || !message) {
    return res.status(400).json({ error: 'phone and message required' });
  }
  const supportMsg = {
    id: uuidv4(),
    phone: normalizePhone(phone),
    transactionCode,
    message,
    status: 'open',
    createdAt: new Date()
  };
  supportMessages.push(supportMsg);
  console.log('[support] New message from', supportMsg.phone, ':', message);
  res.json({ message: 'Support message sent successfully', id: supportMsg.id });
});

// Get support messages (admin)
app.get('/api/support', (req, res) => {
  res.json({ supportMessages: supportMessages.slice().reverse() });
});

// Get transactions
app.get('/api/transactions', (req, res) => {
  res.json({ transactions: transactions.slice().reverse() });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Swift WiFi API listening on http://localhost:${PORT}`);
  console.log(`  Environment: ${process.env.MPESA_ENVIRONMENT || 'sandbox'}`);
  console.log(`  Shortcode: ${process.env.MPESA_SHORTCODE || '174379 (sandbox default)'}`);
});
