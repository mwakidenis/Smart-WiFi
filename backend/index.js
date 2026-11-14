const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { stkPush, parseStkCallback, normalizePhone } = require('./services/mpesa');

const app = express();
app.use(cors());
app.use(express.json());

// In-memory storage
const users = [];
const packages = [];
const transactions = [];

// Seed default packages — time-based with different speeds
packages.push(
  { id: uuidv4(), name: 'Hourly Surf', speedMbps: 5, durationMin: 60, price: 50, currency: 'KES' },
  { id: uuidv4(), name: 'Day Pass', speedMbps: 10, durationMin: 1440, price: 100, currency: 'KES' },
  { id: uuidv4(), name: 'Weekend Bundle', speedMbps: 15, durationMin: 4320, price: 250, currency: 'KES' },
  { id: uuidv4(), name: 'Monthly Unlimited', speedMbps: 25, durationMin: 43200, price: 999, currency: 'KES' }
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

    const pkg = packages.find(p => p.id === packageId);
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
