# Smart Wifi

Simple M-Pesa Wi-Fi Hotspot Billing System.

## Languages and Technologies

### Languages and File Formats

- **JavaScript** - Backend services, API routes, browser scripts, and legacy static-page logic
- **TypeScript** - Typed frontend components, hooks, utilities, and router adapter code
- **TSX / JSX** - React and Next.js component markup
- **HTML** - Static captive portal document structure
- **CSS** - Global styles, responsive layouts, animations, and the static portal theme
- **Tailwind CSS** - Utility-first styling for the Next.js frontend
- **Prisma Schema** - Database models and PostgreSQL ORM definitions
- **SQL** - PostgreSQL data model and queries through Prisma
- **JSON** - Package metadata, API payloads, configuration, and `package.json` manifests
- **Markdown** - Documentation, contribution guides, and project metadata
- **Shell scripting** - Local development and deployment commands

### Frameworks, Libraries, and Protocols

- **Node.js** and **Express.js** - Backend runtime and HTTP API server
- **React** and **Next.js App Router** - Frontend application and page routing
- **AJAX** - Asynchronous browser-server communication without full-page reloads
- **Fetch API** and **Axios** - HTTP requests from frontend and backend code
- **Zustand** - Client-side state management
- **Framer Motion** - Frontend transitions and interaction animations
- **Lucide React** - Interface icons
- **Prisma ORM** with **PostgreSQL** - Persistence and transactional billing data
- **M-Pesa Daraja API** - Safaricom STK Push payments and callbacks
- **Server-Sent Events (SSE)** - Lightweight payment status updates
- **MikroTik RouterOS API**, **CoovaChilli**, and mock router adapters - Hotspot authorization
- **Cloudflare Pages/Workers** and **Wrangler** - Deployment tooling

## Quick Start (Local)

```bash
# Install dependencies
npm install

# Copy env example
cp .env.example .env
# Edit .env with your M-Pesa Daraja credentials

# Start backend (port 4000)
npm run backend

# Start frontend (port 3000)
npm run frontend
```

Open **http://localhost:3000**.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/packages` | List Wi-Fi packages (time-based, speed-based) |
| POST | `/api/mpesa/stk-push` | Initiate real Daraja STK Push |
| POST | `/api/mpesa/callback` | Safaricom callback (idempotent, always 200) |
| GET | `/api/transactions` | List transactions |

## M-Pesa Daraja STK Push Flow

1. Customer clicks Buy → enters phone number
2. Backend creates a PENDING transaction with unique CheckoutRequestID
3. Backend calls Daraja `stkpush/v1/processrequest` → prompts customer's phone
4. Customer enters PIN (off your servers)
5. Safaricom POSTs to `/api/mpesa/callback` with ResultCode
6. Callback is idempotent (keyed on CheckoutRequestID) — never double-credits
7. On ResultCode 0, user balance is credited

**Note:** The STK Push initiate response only means the prompt was *sent*. Only the callback (ResultCode 0 + MpesaReceiptNumber) confirms payment was actually received.

## Cloudflare Pages Deployment

```bash
npm install
npx wrangler login
npx wrangler kv:namespace create "SWIFT_DB"
# Paste KV IDs into wrangler.toml
npm run deploy
```

made with ❤️ by mwakidenis

