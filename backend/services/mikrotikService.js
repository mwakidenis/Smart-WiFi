// backend/services/mikrotikService.js
// MikroTik RouterOS API client for Smart Wifi
// Socket-based communication for MAC whitelisting of paid users
// Follows the Comprehensive System Prompt & Engineering Specification

const net = require('net');

class MikroTikService {
  constructor() {
    this.host = process.env.MIKROTIK_HOST || "192.168.88.1";
    this.port = parseInt(process.env.MIKROTIK_PORT || "8728", 10);
    this.user = process.env.MIKROTIK_USERNAME || "admin";
    this.password = process.env.MIKROTIK_PASSWORD || "";
    this.connected = false;
  }

  /**
   * Encode a word for RouterOS API (length-prefixed).
   */
  encodeWord(str) {
    const buf = Buffer.from(str, "utf8");
    const len = buf.length;
    const out = [];
    if (len <= 0x7f) {
      out.push(len);
    } else if (len <= 0x3fff) {
      out.push(0x80 | (len >>> 8), len & 0xff);
    } else if (len <= 0x1fffff) {
      out.push(0xc0 | (len >>> 16), 0x80 | ((len >>> 8) & 0xff), len & 0xff);
    } else if (len <= 0x0fffffff) {
      out.push(0xe0 | (len >>> 24), 0x80 | ((len >>> 16) & 0xff), 0x80 | ((len >>> 8) & 0xff), len & 0xff);
    } else {
      out.push(0xf0, 0x80 | ((len >>> 24) & 0xff), 0x80 | ((len >>> 16) & 0xff), 0x80 | ((len >>> 8) & 0xff), len & 0xff);
    }
    return Buffer.concat([Buffer.from(out), buf]);
  }

  /**
   * Encode a full API command: words followed by zero-length word (0x00).
   */
  encodeCommand(words) {
    const parts = words.map((w) => this.encodeWord(w));
    parts.push(Buffer.alloc(1));
    return Buffer.concat(parts);
  }

  /**
   * Parse API response words from a buffer.
   */
  parseWords(buf) {
    const words = [];
    let offset = 0;
    while (offset < buf.length) {
      const b = buf[offset];
      let len;
      if ((b & 0xf0) === 0xf0) {
        offset += 1;
        len = ((buf[offset] & 0x7f) << 24) | ((buf[offset + 1] & 0x7f) << 16) | ((buf[offset + 2] & 0x7f) << 8) | (buf[offset + 3] & 0x7f);
        offset += 4;
      } else if ((b & 0xe0) === 0xe0) {
        len = ((b & 0x1f) << 16) | ((buf[offset + 1] & 0x7f) << 8) | (buf[offset + 2] & 0x7f);
        offset += 3;
      } else if ((b & 0xc0) === 0xc0) {
        len = ((b & 0x3f) << 8) | (buf[offset + 1] & 0x7f);
        offset += 2;
      } else {
        len = b & 0x7f;
        offset += 1;
      }
      if (len === 0) break;
      words.push(buf.slice(offset, offset + len).toString("utf8"));
      offset += len;
    }
    return words;
  }

  /**
   * Convert word array to key/value object.
   */
  wordsToObject(words) {
    const obj = {};
    for (let i = 0; i < words.length; i += 2) {
      const key = words[i];
      const val = words[i + 1];
      if (key !== undefined) obj[key] = val;
    }
    return obj;
  }

  /**
   * Send a command to RouterOS API and await the final !done or !trap.
   */
  async sendCommand(words, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      let received = Buffer.alloc(0);
      let timer;

      const cleanup = () => {
        clearTimeout(timer);
        socket.destroy();
      };

      timer = setTimeout(() => {
        cleanup();
        reject(new Error("MikroTik API request timed out"));
      }, timeoutMs);

      socket.setEncoding(null);

      socket.on("connect", () => {
        socket.write(this.encodeCommand(["/login", `name=${this.user}`, `password=${this.password}`]));
      });

      socket.on("data", (chunk) => {
        received = Buffer.concat([received, chunk]);
        const words = this.parseWords(received);
        const last = words[words.length - 1] || "";
        if (last === "!done" || last === "!trap" || last === "!fatal") {
          cleanup();
          socket.destroy();
          if (last === "!done") {
            resolve(this.wordsToObject(words));
          } else {
            reject(new Error(`RouterOS error: ${this.wordsToObject(words).message || words.join(" ")}`));
          }
          return;
        }
        break;
      });

      socket.on("error", (err) => {
        cleanup();
        reject(err);
      });

      socket.connect(this.port, this.host);
    });
  }

  /**
   * Whitelist a MAC address on the MikroTik hotspot (bypass type).
   * @param {string} macAddress - MAC address to whitelist
   * @param {string} comment - Comment for the entry
   */
  async whitelistMacAddress(macAddress, comment = "Paid via M-Pesa") {
    const result = await this.sendCommand([
      "/ip/hotspot/ip-binding/add",
      "=type=bypassed",
      `=mac-address=${macAddress}`,
      `=comment=${comment}`,
    ]);
    return { success: true, macAddress, result };
  }

  /**
   * Remove a whitelisted MAC address.
   */
  async removeWhitelistMacAddress(macAddress) {
    const result = await this.sendCommand([
      "/ip/hotspot/ip-binding/remove",
      `=numbers=*${macAddress}`,
    ]);
    return { success: true, macAddress, result };
  }

  /**
   * Get router health (system resource info).
   */
  async getRouterHealth() {
    const resource = await this.sendCommand(["/system/resource/print"]);
    const interfaces = await this.sendCommand(["/interface/print"]);
    return { resource, interfaces };
  }
}

module.exports = new MikroTikService();
