# WASTRO Admin Server

Node.js + Express + TypeScript API for the WASTRO admin panel (Phase 06 inventory).

## Prerequisites

- Node.js 20+
- Local PostgreSQL 16+ (managed with pgAdmin)

## PostgreSQL (pgAdmin)

Create a database and login role that match `.env`:

| Field | Value |
| --- | --- |
| Host | `localhost` |
| Port | `5432` |
| Database | `wastro_admin` |
| Username | `wastro` |
| Password | `wastro` |

In pgAdmin:

1. Create Login/Group Role `wastro` with password `wastro` (and login privilege).
2. Create database `wastro_admin` owned by `wastro`.
3. Confirm you can connect with those credentials.

If you use different credentials, update `DATABASE_URL` in `.env`.

## Setup

```bash
cp .env.example .env
# set SESSION_SECRET and ADMIN_BOOTSTRAP_* values
npm install
npm run migrate
npm run seed:admin
npm run dev
```

API: `http://localhost:4000`  
Health: `http://localhost:4000/api/v1/health`  
Auth CSRF: `http://localhost:4000/api/v1/auth/csrf`  
Dashboard: `http://localhost:4000/api/v1/dashboard/summary`  
Categories: `http://localhost:4000/api/v1/categories`  
Products: `http://localhost:4000/api/v1/products`  
Inventory: `http://localhost:4000/api/v1/inventory/levels`

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start API with hot reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled server |
| `npm run migrate` | Apply pending SQL migrations |
| `npm run migrate:down` | Roll back the latest migration |
| `npm run seed:admin` | Create/update bootstrap super admin from env |
| `npm run typecheck` | TypeScript check only |
| `npm run lint` | ESLint |
| `npm run format` | Prettier write |

## Auth notes

- Sessions use HttpOnly cookie `wastro.sid` (Postgres-backed)
- CSRF uses cookie `wastro.csrf`; send token in `x-csrf-token` on mutating requests
- Login is rate-limited
- Permissions are enforced with `requireAuth` / `requirePermission` middleware

## API response shape

Success:

```json
{ "data": {}, "meta": {} }
```

Error:

```json
{
  "error": { "code": "UNAUTHORIZED", "message": "Authentication required" },
  "requestId": "uuid"
}
```
