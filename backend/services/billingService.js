// backend/services/billingService.js
// M-Pesa Daraja STK Push service for Smart Wifi
// Follows the Comprehensive System Prompt & Engineering Specification

const axios = require('axios');
const prisma = require('../config/database');

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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(`${baseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
      method: "GET",
      headers: {
        Authorization: "Basic " + auth,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error("Daraja OAuth failed: " + res.status + " " + text);
    }

    const data = await res.json();
    const token = data.access_token;
    const expiresIn = parseInt(data.expires_in, 10) || 3600;
    cachedToken = { token, expiresAt: now + (expiresIn - 60) * 1000 };
    return token;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * BillingService class for M-Pesa STK Push operations.
 */
class BillingService {
  async initiateStkPush({ phoneNumber, amount, packageId, userId, macAddress }) {
    // Validate package
    const pkg = await prisma.package.findUnique({
      where: { id: packageId },
    });

    if (!pkg || !pkg.isActive) {
      throw new Error("Package not found or inactive");
    }

    const timestamp = darajaTimestamp();
    const token = await getAccessToken();
    const shortcode = process.env.MPESA_SHORTCODE || "174379";
    const callbackUrl = process.env.MPESA_CALLBACK_URL || "http://localhost:4000/api/mpesa/callback";

    const payload = {
      BusinessShortCode: shortcode,
      Password: darajaPassword(timestamp),
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.round(Number(amount)),
      PartyA: normalizePhone(phoneNumber),
      PartyB: shortcode,
      PhoneNumber: normalizePhone(phoneNumber),
      CallBackURL: callbackUrl,
      AccountReference: "SwiftWiFi",
      TransactionDesc: `Wi-Fi Bundle: ${pkg.name}`,
      CheckoutRequestID: `swift_${userId}_${Date.now()}`,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch(`${baseUrl()}/mpesa/stkpush/v1/processrequest`, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify(payload),
      });

      clearTimeout(timeoutId);

      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.ResponseCode !== "0") {
        throw new Error(
          body.errorMessage || body.CustomerMessage || "STK Push failed (HTTP " + res.status + ")"
        );
      }

      // Create transaction record (PENDING)
      const tx = await prisma.transaction.create({
        data: {
          userId,
          packageId,
          type: "PAYMENT",
          amount: pkg.price,
          status: "PENDING",
          checkoutRequestId: body.CheckoutRequestID,
          phone: normalizePhone(phoneNumber),
          description: `M-Pesa STK Push: ${phoneNumber} KES ${pkg.price}`,
        },
      });

      return {
        checkoutRequestID: body.CheckoutRequestID,
        merchantRequestID: body.MerchantRequestID,
        transactionId: tx.id,
        customerMessage: body.CustomerMessage,
        responseCode: body.ResponseCode,
      };
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  /**
   * Parse a Safaricom STK callback into a flat result object.
   */
  parseStkCallback(body) {
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

  /**
   * Process M-Pesa callback idempotently.
   * Always returns 200 to Safaricom to prevent retries.
   */
  async processCallback(body) {
    const parsed = this.parseStkCallback(body);
    if (!parsed) {
      console.error('[callback] Unparseable callback body');
      return { success: false, error: "unparseable" };
    }

    const { checkoutRequestID, resultCode, resultDesc, amount, receipt, phone, success } = parsed;

    // Idempotency: find the transaction by CheckoutRequestID
    const tx = await prisma.transaction.findFirst({
      where: { checkoutRequestId },
      include: { package: true },
    });

    if (!tx) {
      console.error('[callback] Unknown CheckoutRequestID:', checkoutRequestID);
      return { success: false, error: "unknown_checkout_id" };
    }

    // If already finalised, ignore (duplicate callback)
    if (tx.status !== "PENDING") {
      console.log('[callback] Duplicate callback for', checkoutRequestID, 'status already:', tx.status);
      return { success: true, alreadyProcessed: true };
    }

    if (success) {
      // Mark completed + credit user balance
      const updated = await prisma.$transaction(async (txClient) => {
        const claimed = await txClient.transaction.updateMany({
          where: { id: tx.id, status: "PENDING" },
          data: {
            status: "COMPLETED",
            mpesaReceipt: receipt,
            amount,
            durationMin: tx.package?.durationMin || null,
            expiresAt: tx.package ? new Date(Date.now() + tx.package.durationMin * 60 * 1000) : null,
            description: `Completed: ${resultDesc}`,
            updatedAt: new Date(),
          },
        });

        if (claimed.count !== 1) return null;

        const updatedTx = await txClient.transaction.findUnique({ where: { id: tx.id } });

        await txClient.user.update({
          where: { id: tx.userId },
          data: { balance: { increment: amount } },
        });

        await txClient.auditLog.create({
          data: {
            userId: tx.userId,
            action: "PAYMENT_COMPLETED",
            entity: "Transaction",
            entityId: tx.id,
            metadata: { checkoutRequestID, mpesaReceipt: receipt, amount, resultCode, resultDesc },
          },
        });

        return updatedTx;
      });

      if (!updated) {
        console.log('[callback] Duplicate callback for', checkoutRequestID);
        return { success: true, alreadyProcessed: true };
      }

      console.log('[callback] PAID', checkoutRequestID, 'KES', amount, 'receipt:', receipt);
      return { success: true, transaction: updated };
    } else {
      // Failed / cancelled / timeout
      const updatedTx = await prisma.transaction.update({
        where: { id: tx.id },
        data: {
          status: "FAILED",
          failureReason: resultDesc,
          updatedAt: new Date(),
        },
      });

      console.log('[callback] FAILED', checkoutRequestID, resultCode, resultDesc);
      return { success: false, transaction: updatedTx };
    }
  }
}

module.exports = new BillingService();
