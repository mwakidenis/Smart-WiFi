// Smart Wifi — M-Pesa Daraja STK Push service
// Implements the Safaricom Daraja API pattern.
//
// Key invariants:
//   * Password = Base64(Shortcode + PassKey + Timestamp YYYYMMDDHHmmss)
//   * Phone normalized to 2547XXXXXXXX (no +, no leading 0)
//   * Amount must be whole integer KES
//   * STK initiate response is NOT payment confirmation — only the callback is
//   * Callback must always return HTTP 200 quickly (ack first, process after)
//   * Idempotency via CheckoutRequestID unique check (never double-credit)
//   * Callback URL must be public HTTPS (no localhost in production)

const BASE_URL_SANDBOX = "https://sandbox.safaricom.co.ke";
const BASE_URL_PRODUCTION = "https://api.safaricom.co.ke";

let cachedToken = { token: null, expiresAt: 0 };

function isSandbox() {
  return (process.env.MPESA_ENVIRONMENT || "sandbox") === "sandbox";
}

function baseUrl() {
  return isSandbox() ? BASE_URL_SANDBOX : BASE_URL_PRODUCTION;
}

/**
 * Normalize a Kenyan phone number to 2547XXXXXXXX format.
 * Accepts: 0712345678, +254712345678, 254712345678
 */
function normalizePhone(phone) {
  let p = String(phone).replace(/\D/g, "");
  if (p.startsWith("0")) p = "254" + p.slice(1);
  if (p.startsWith("+")) p = p.slice(1);
  if (!p.startsWith("254")) p = "254" + p;
  return p;
}

/**
 * Generate Daraja timestamp YYYYMMDDHHmmss.
 */
function darajaTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    now.getFullYear() +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds())
  );
}

/**
 * Generate the Lipa Na M-Pesa Online password:
 * Base64(Shortcode + PassKey + Timestamp)
 */
function darajaPassword(timestamp) {
  const shortcode = process.env.MPESA_SHORTCODE || "174379";
  const passkey = process.env.MPESA_PASSKEY || "";
  const material = shortcode + passkey + timestamp;
  return Buffer.from(material).toString("base64");
}

/**
 * Get a Daraja OAuth access token, cached until ~60s before expiry.
 */
async function getAccessToken() {
  const now = Date.now();
  if (cachedToken.token && cachedToken.expiresAt > now + 60 * 1000) {
    return cachedToken.token;
  }

  const consumerKey = process.env.MPESA_CONSUMER_KEY || "";
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET || "";
  const auth = Buffer.from(consumerKey + ":" + consumerSecret).toString("base64");

  const res = await fetch(`${baseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
    method: "GET",
    headers: {
      Authorization: "Basic " + auth,
    },
    timeout: 15000,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error("Daraja OAuth failed: " + res.status + " " + text);
  }

  const data = await res.json();
  const token = data.access_token;
  const expiresIn = parseInt(data.expires_in, 10) || 3600;
  cachedToken = { token, expiresAt: now + (expiresIn - 60) * 1000 };
  return token;
}

/**
 * Initiate an M-Pesa STK Push (Lipa Na M-Pesa Online).
 * @param {Object} params
 * @param {string} params.phone - Kenyan phone (07xx, +254xx, or 254xx)
 * @param {number} params.amount - whole KES amount
 * @param {string} params.accountReference
 * @param {string} params.transactionDesc
 * @param {string} params.checkoutRequestId - optional idempotency key
 * @returns {Promise<Object>} Daraja response incl. CheckoutRequestID
 */
async function stkPush(params) {
  const timestamp = darajaTimestamp();
  const token = await getAccessToken();
  const shortcode = process.env.MPESA_SHORTCODE || "174379";
  const callbackUrl = process.env.MPESA_CALLBACK_URL || "http://localhost:4000/api/mpesa/callback";

  const payload = {
    BusinessShortCode: shortcode,
    Password: darajaPassword(timestamp),
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: Math.round(Number(params.amount)),
    PartyA: normalizePhone(params.phone),
    PartyB: shortcode,
    PhoneNumber: normalizePhone(params.phone),
    CallBackURL: callbackUrl,
    AccountReference: params.accountReference || "SwiftWiFi",
    TransactionDesc: params.transactionDesc || "Wi-Fi Top-up",
  };

  if (params.checkoutRequestId) {
    payload.CheckoutRequestID = params.checkoutRequestId;
  }

  const res = await fetch(`${baseUrl()}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    timeout: 30000,
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.ResponseCode !== "0") {
    throw new Error(
      body.errorMessage || body.CustomerMessage || "STK Push failed (HTTP " + res.status + ")"
    );
  }
  return body;
}

/**
 * Parse a Safaricom STK callback into a flat result object.
 * @param {Object} body - raw callback body
 * @returns {Object|null} { checkoutRequestID, resultCode, resultDesc, amount, receipt, phone, success } or null
 */
function parseStkCallback(body) {
  try {
    const cb = body && body.Body && body.Body.stkCallback;
    if (!cb) return null;

    const checkoutRequestID = cb.CheckoutRequestID;
    const resultCode = cb.ResultCode;
    const resultDesc = cb.ResultDesc || "";

    let amount = 0;
    let receipt = null;
    let phone = null;

    const items = cb.CallbackMetadata && cb.CallbackMetadata.Item;
    if (Array.isArray(items)) {
      for (const item of items) {
        if (item.Name === "Amount") amount = Number(item.Value);
        if (item.Name === "MpesaReceiptNumber") receipt = String(item.Value);
        if (item.Name === "PhoneNumber") phone = String(item.Value);
      }
    }

    return {
      checkoutRequestID,
      resultCode,
      resultDesc,
      amount,
      receipt,
      phone,
      success: resultCode === 0,
    };
  } catch (e) {
    return null;
  }
}

module.exports = {
  stkPush,
  parseStkCallback,
  normalizePhone,
  darajaTimestamp,
  darajaPassword,
  getAccessToken,
  BASE_URL_SANDBOX,
  BASE_URL_PRODUCTION,
  isSandbox,
};

