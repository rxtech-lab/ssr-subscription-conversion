# SSR Subscription Conversion

A web application for importing, managing, and converting proxy subscription configurations across multiple client formats. Import a Surge, Clash, or V2Ray config, manage servers and proxy groups through a UI or natural-language AI assistant, and share tokenized subscription links that deliver the config in any supported format.

## Features

- **Multi-format support** — Import and export subscriptions in Surge, Clash, and V2Ray formats
- **Subscription management** — Add, edit, and delete proxy servers (Shadowsocks, VMess, Trojan, Direct, Reject) and proxy groups (select, url-test, fallback, load-balance)
- **Tokenized delivery** — Generate shareable links (`/api/sub/<token>`) that serve the subscription file in the correct format with proper `Content-Type` headers
- **AI assistant** — Natural-language chat interface for querying and mutating subscriptions (powered by Google Gemini via Vercel AI Gateway)
- **Encrypted storage** — Proxy server settings are AES-256-GCM encrypted at rest using `AUTH_SECRET` as the key
- **Authentication** — OIDC-based login via NextAuth v5 (RxLab identity provider)

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS v4, shadcn/ui |
| Database | Turso (LibSQL/SQLite) via Drizzle ORM |
| Auth | NextAuth v5 (OIDC) |
| AI | Vercel AI SDK + Google Gemini |
| Testing | Vitest |
| Runtime | Bun |

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) installed
- A [Turso](https://turso.tech) database
- An OIDC identity provider (or RxLab account)

### Installation

```bash
bun install
```

### Environment Variables

Create a `.env.local` file in the project root:

```env
# Database (Turso / LibSQL)
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-turso-auth-token

# NextAuth — also used as the AES-256 encryption key for proxy settings
AUTH_SECRET=your-random-secret-at-least-32-chars

# OIDC Provider
AUTH_ISSUER=https://your-oidc-issuer.example.com
AUTH_CLIENT_ID=your-client-id
AUTH_CLIENT_SECRET=your-client-secret

# AI Gateway (Vercel AI Gateway — for the AI assistant)
# See https://ai-sdk.dev/docs/ai-sdk-core/gateway for supported providers
AI_GATEWAY_API_KEY=your-ai-gateway-key
```

### Database Setup

```bash
# Generate migrations
bun db:generate

# Apply migrations
bun db:migrate

# Open Drizzle Studio (optional)
bun db:studio
```

### Development

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Scripts

| Command | Description |
|---|---|
| `bun dev` | Start development server |
| `bun build` | Build for production |
| `bun start` | Start production server |
| `bun test` | Run tests with Vitest |
| `bun db:generate` | Generate Drizzle migrations from schema |
| `bun db:migrate` | Apply pending migrations |
| `bun db:studio` | Open Drizzle Studio |

## Subscription API

Once a subscription link is generated, it can be fetched by any proxy client:

```
GET /api/sub/<token>
```

The response format and `Content-Type` are determined by the `outputFormat` stored with the link:

| Format | Content-Type | Extension |
|---|---|---|
| `surge` | `text/plain` | `.conf` |
| `clash` | `text/yaml; charset=utf-8` | `.yaml` |
| `v2ray` | `text/plain` | `.txt` |

## Supported Proxy Types

- **Shadowsocks** (`ss`) — encrypt-method, password, obfs, udp-relay, etc.
- **VMess** (`vmess`) — uuid, alterId, cipher, tls, etc.
- **Trojan** (`trojan`) — password, sni, skip-cert-verify, etc.
- **Direct** — pass traffic without a proxy
- **Reject** — block matching traffic

## Testing

```bash
bun test
```

Tests cover parsers, generators, format detection, and crypto utilities for all three subscription formats.
