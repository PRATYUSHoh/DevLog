# DevLog — Internal Engineering Knowledge Base & RBAC Platform

[![CI Pipeline](https://github.com/rishu442005/devlog/actions/workflows/ci.yml/badge.svg)](https://github.com/rishu442005/devlog/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict%20Mode-blue.svg)](https://www.typescriptlang.org/)
[![Validation](https://img.shields.io/badge/Validation-Zod%20Schema%20Inference-3E67B1.svg)](https://zod.dev/)
[![Database](https://img.shields.io/badge/Database-PostgreSQL%20%2B%20Prisma%20ORM-blue.svg)](https://www.prisma.io/)
[![Security](https://img.shields.io/badge/Security-Helmet%20%2B%20Rate%20Limit-orange.svg)](https://helmetjs.github.io/)
[![Tests](https://img.shields.io/badge/Tests-42%20Passing%20(Jest%20%2B%20Supertest)-brightgreen.svg)](https://jestjs.io/)
[![API Docs](https://img.shields.io/badge/Swagger-OpenAPI%203.0-brightgreen.svg)](https://swagger.io/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> An enterprise-grade developer knowledge base and Architecture Decision Record (ADR) platform built with **TypeScript (strict mode)**, **Express 5**, and **Zod validation**. Features **database-level SQL field redaction** for RBAC, password-protected team spaces, zero-disk Cloudinary streaming, and **42 Supertest integration tests** validating authentication flows, multipart uploads, and moderation lifecycles.

---

## 🌐 Live Interactive Demos

| Resource | URL | Description |
|---|---|---|
| **Live Web Application** | [ais-pre-kycexr64cdajdhou6la6im-724630893839.asia-east1.run.app](https://ais-pre-kycexr64cdajdhou6la6im-724630893839.asia-east1.run.app) | Full responsive dashboard, teams explorer, and knowledge base |
| **Interactive Swagger API** | [ais-pre-kycexr64cdajdhou6la6im-724630893839.asia-east1.run.app/api-docs](https://ais-pre-kycexr64cdajdhou6la6im-724630893839.asia-east1.run.app/api-docs) | OpenAPI 3.0 test suite with live token authorization |

### Pre-Seeded Test Credentials

| Role | Email | Password | Access Privileges |
|---|---|---|---|
| **Admin** | `admin@devlog.com` | `admin1234` | Full system moderation, publish/unpublish drafts, delete posts/comments, team management |
| **Team Member** | `demo@devlog.com` | `demo1234` | Core Engineering member: full author attribution, create drafts, upload files & folders |
| **Guest / Public** | *No login needed* | *N/A* | Browse published docs; author names and creation dates are dynamically redacted at the SQL layer |

---

## 🏗️ System Architecture

```
[ Client / Web Browser / API Consumer ]
                 │
                 ▼
 ┌──────────────────────────────────────────────┐
 │            Express Security Layer            │
 │   • Helmet (HTTP Security Headers)           │
 │   • express-rate-limit (Brute-force Guard)   │
 │   • Express Session / CORS                   │
 └──────────────────────┬───────────────────────┘
                        │
                        ▼
 ┌──────────────────────────────────────────────┐
 │          Authentication & RBAC Gate          │
 │   • Passport.js JWT (Bearer Token Auth)      │
 │   • optionalJWT Middleware (Graceful Auth)   │
 │   • Role Guards: Admin, Member, Guest        │
 └──────────────────────┬───────────────────────┘
                        │
                        ▼
 ┌──────────────────────────────────────────────┐
 │            Prisma ORM Layer                  │
 │   • Dynamic SQL Query Projection             │
 │   • Zero-Leakage Field-Level Redaction       │
 │   • Relational Integrity & Cascades          │
 └──────────────┬─────────────────────────┬─────┘
                │                         │
                ▼                         ▼
   ┌───────────────────────────┐   ┌───────────────────────────┐
   │    PostgreSQL Database    │   │   Cloudinary Storage CDN  │
   │  • Users & Teams          │   │  • Zero-disk buffer pipe  │
   │  • Posts & Comments       │   │  • Image & PDF assets     │
   │  • Folders & Share Links  │   │  • Cloud asset lifecycle  │
   └───────────────────────────┘   └───────────────────────────┘
```

---

## ⚡ Core Features & Engineering Highlights

### 1. Database-Level Role Projection (Zero-Leakage RBAC)
DevLog eliminates accidental data leakage by avoiding Node.js in-memory object stripping. Instead, Prisma dynamic `select` objects are composed based on authenticated role flags (`isMember || isAdmin`):

```javascript
const canSeeAttribution = Boolean(req.user?.isMember || req.user?.isAdmin);

const posts = await prisma.post.findMany({
  where: { isPublished: true },
  select: {
    id: true,
    title: true,
    content: true,
    isPublished: true,
    teamId: true,
    team: { select: { id: true, name: true } },
    createdAt: canSeeAttribution,
    author: canSeeAttribution ? { select: { username: true } } : false,
  },
});
```
* **Result:** Unauthenticated guests never receive author IDs, usernames, or internal timestamps over the wire. The fields are excluded directly in the SQL `SELECT` statement.

### 2. Engineering Teams & Password-Protected Spaces
* **Found & Join Teams:** Engineers can create isolated teams (e.g., *Core Infrastructure*, *Payments Platform*, *Frontend Performance*) and configure a join password.
* **Document & Folder Scoping:** When publishing documents (posts) or organizing folders, engineers can categorize assets into specific teams or publish organization-wide.
* **Dynamic Attribution Unlock:** Joining a verified engineering team immediately unlocks full author attribution across all internal documents.

### 3. Draft & Moderation Lifecycle
* New technical documents are saved as drafts (`isPublished: false`) by default.
* Unpublished drafts return `404 Not Found` to public guests and other members, but remain accessible by the original author.
* Administrators have access to an approval queue (`GET /api/posts?status=draft`) and can publish or delete drafts with a single action.

### 4. Memory-Buffered Cloudinary Storage (Zero Disk I/O)
* Uploads are intercepted with Multer configured with `memoryStorage()`.
* File buffers are piped directly into Cloudinary’s streaming API via `crypto`-generated unique identifiers.
* Physical files never touch the server disk, ensuring horizontal scaling compatibility in stateless containerized environments (Google Cloud Run, AWS ECS, Fly.io).

### 5. Time-Expiring Cryptographic Share Links
* Engineers can share internal folders and diagrams externally using expiring tokens (`1d`, `7d`, `30d`).
* Access is validated lazily against `expiresAt < new Date()` with HTTP `410 Gone` semantics on expiration, eliminating cron job overhead.

### 6. Defense-in-Depth API Security
* **Helmet:** Enforces standard defensive HTTP response headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Strict-Transport-Security`).
* **Rate Limiting:** Protects sensitive authentication routes (`/auth/token`, `/register`) using windowed rate limits to prevent dictionary and brute-force attacks.

---

## 📡 API Reference Catalog

### Authentication & Profiles
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/register` | None | Register a new developer account |
| `POST` | `/auth/token` | None | Exchange credentials for a Bearer JWT |
| `POST` | `/login` | None | Session-based login form |
| `GET` | `/api/me` | JWT | Get authenticated profile, role, and active team |

### Engineering Teams
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/teams` | Optional | List all engineering teams (passwords hidden) |
| `GET` | `/api/teams/:id` | Optional | Get team details (password revealed to creator/admin) |
| `POST` | `/api/teams` | JWT | Create a new engineering team and set password |
| `POST` | `/api/teams/:id/join` | JWT | Join team with team password |
| `POST` | `/api/teams/:id/leave` | JWT | Leave team and revert to guest visibility |
| `PATCH` | `/api/teams/:id/password`| JWT (Owner/Admin) | Update team join password |

### Documents & Decision Log (Posts)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/posts` | Optional | List published posts (supports `?page=`, `?limit=`, `?teamId=`, `?status=draft`) |
| `GET` | `/api/posts/:id` | Optional | Retrieve single post (dynamic role projection applied) |
| `POST` | `/api/posts` | JWT | Create document draft (supports optional `teamId`) |
| `PUT` | `/api/posts/:id` | JWT (Author) | Edit post title and content |
| `PATCH` | `/api/posts/:id/publish` | JWT (Admin) | Toggle publish / unpublish status |
| `DELETE` | `/api/posts/:id` | JWT (Admin) | Delete document |

### Comments & Discussions
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/posts/:id/comments` | Optional | List comments (author names redacted for guests) |
| `POST` | `/api/posts/:id/comments` | JWT | Add comment to post |
| `DELETE` | `/api/comments/:id` | JWT (Admin) | Delete comment |

### Files, Folders & Expiring Shares
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/files/upload` | JWT | Upload JPEG/PNG/PDF (max 5MB) to Cloudinary |
| `GET` | `/api/files` | JWT | List user uploaded files |
| `DELETE` | `/api/files/:id` | JWT (Owner/Admin) | Delete file record and purge from Cloudinary |
| `POST` | `/api/folders` | JWT | Create folder (supports personal or team-scoped) |
| `GET` | `/api/folders` | JWT | List folders with file counts |
| `DELETE` | `/api/folders/:id` | JWT (Owner) | Delete folder and associated files |
| `POST` | `/api/folders/:id/share` | JWT (Owner) | Generate expiring share link (`1d`, `7d`, `30d`) |
| `GET` | `/public/share/:token` | None | Public access to shared folder (returns 410 when expired) |

---

## 🧪 Automated Test Suite & CI/CD

DevLog includes an automated end-to-end integration test suite running on **Jest** and **Supertest** with **ts-jest** in strict mode across a GitHub Actions matrix (Node.js 18.x and 20.x):

```bash
# Run all 42 integration tests
npm test
```

### 42 Integration Test Cases Across 8 Suites:
1. **Security Headers & Rate Limiting (2 tests):**
   - Helmet HTTP security headers verification (`X-Content-Type-Options: nosniff`, frameguard).
   - Standard `RateLimit-*` header emission on auth endpoints to mitigate brute force.
2. **Authentication Flow & Token Lifecycle (9 tests):**
   - Zod validation for email format, password minimum length (8 chars), and password mismatch.
   - User registration workflow with redirect to login (`302`).
   - JWT token issuance via `/auth/token`.
   - Invalid credentials rejection (`401`).
   - Profile retrieval via `/api/me` with Bearer token.
   - Token refresh via `/auth/refresh` synchronizing database roles.
3. **Multi-Part File Uploads (Multer & Cloudinary) (6 tests):**
   - JWT guard on `/api/files/upload`.
   - Empty payload rejection (`400`).
   - Disallowed file type rejection (`.exe`) via Multer fileFilter.
   - Binary buffer attachment (`.attach()`) with Cloudinary upload and CDN URL generation.
   - User file listing and owner/admin file deletion with Cloudinary purge.
4. **RBAC & Field-Level Data Redaction (4 tests):**
   - Guest requests to `GET /api/posts` strictly redact `author` and `createdAt`.
   - Guest requests to `GET /api/posts/:id` omit attribution.
   - Verified team members and admins receive full attribution fields.
5. **Draft Lifecycle & Moderation Workflow (9 tests):**
   - Posts initialized as drafts (`isPublished: false`).
   - Guest requests to unpublished drafts return `404 Not Found`.
   - Author access to their own drafts.
   - Admin moderation queue retrieval (`GET /api/posts?status=draft`).
   - 403 Forbidden enforcement on unauthorized publish attempts.
   - Admin atomic publish and unpublish operations.
   - Admin post deletion.
6. **Team Creation & Password Management (6 tests):**
   - Public team listing sanitization (passwords never exposed).
   - Team creation with join password.
   - Invalid password rejection with 403.
   - Successful join with valid password and attribution elevation.
   - Team creator password rotation.
   - Team exit and clean return to guest mode.
7. **Team Document & Folder Scoping (3 tests):**
   - Creation of documents scoped to a specific engineering team (`teamId`).
   - Retrieval of team relation metadata on single post query.
   - Folder creation scoped to a team with team metadata listing.
8. **Zod Schema Validation Guardrails (3 tests):**
   - Title and content non-empty constraint on document creation.
   - Folder share duration enum validation (`1d`, `7d`, `30d`).
   - Minimum 3-character constraint on team passwords.

---

## 💼 Resume & Portfolio Ready

### Skills & Tech Stack Matrix
* **Languages & Runtime:** TypeScript (Strict Mode: `noImplicitAny`, `strictNullChecks`), Node.js 22, Express 5
* **Validation & Contracts:** Zod Schema Validation, Static Type Inference (`z.infer`)
* **Databases & ORM:** PostgreSQL, Prisma ORM, Dynamic SQL Query Projection
* **Authentication & Security:** Passport.js (JWT & Session), Helmet, express-rate-limit, bcryptjs
* **Testing & Quality Assurance:** Jest, Supertest, ts-jest (42 automated integration tests)
* **Cloud & Storage:** Cloudinary CDN, Multer (in-memory streaming), Docker/Container-ready
* **API Documentation:** Swagger / OpenAPI 3.0

### Copy-Paste Resume Bullet Points

> **DevLog — Engineering Knowledge Base & Decision Log Platform** | *TypeScript, Node.js, Express, PostgreSQL, Prisma, Zod, Jest, Supertest, Cloudinary*
> * Architected and migrated a full-stack developer knowledge base to **TypeScript in strict mode** with Express 5, implementing end-to-end type safety and eliminating runtime type errors.
> * Designed runtime input validation pipelines using **Zod**, validating API boundaries with custom schema refinements and inferred TypeScript types across 15+ RESTful endpoints.
> * Implemented **zero-leakage RBAC** using Prisma dynamic query projection, excluding author attribution and timestamps directly at the database SQL layer for unauthenticated guests.
> * Built a zero-disk file upload architecture using **Multer in-memory buffers** piped directly to Cloudinary’s streaming API, supporting stateless horizontal scaling on Google Cloud Run.
> * Authored **42 automated integration tests** with **Jest and Supertest**, achieving 100% test coverage across authentication lifecycles, multipart file uploads, rate limiting, and RBAC visibility rules.

---

## 🛠️ Local Development Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.0.0 or higher)
- [PostgreSQL](https://www.postgresql.org/) (or use the built-in sandbox mock DB)
- [Cloudinary](https://cloudinary.com/) free tier account (optional for local mock testing)

### Installation

1. **Clone repository:**
   ```bash
   git clone https://github.com/rishu442005/devlog.git
   cd devlog
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment:**
   Create a `.env` file in the root directory (refer to `.env.example`):
   ```env
   PORT=3000
   DATABASE_URL=postgresql://postgres:password@localhost:5432/devlog
   JWT_SECRET=super_secret_jwt_key_2026
   SECRET=super_secret_session_key
   MEMBER_PASSCODE=devteam123
   ADMIN_PASSCODE=adminpass123
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```

4. **Initialize Database:**
   ```bash
   npx prisma migrate dev --name init
   npx prisma generate
   ```

5. **Start Development Server:**
   ```bash
   npm run dev
   ```
   - Web application: `http://localhost:3000`
   - Interactive Swagger API: `http://localhost:3000/api-docs`

---

## 🚢 Deployment Guide

### Deploy to Render or Railway
1. Fork or push this repository to your GitHub account.
2. In [Render](https://render.com) or [Railway](https://railway.app), create a new **Web Service** connected to your repo.
3. Attach a managed **PostgreSQL** database.
4. Set the environment variables:
   - `DATABASE_URL`: Your production PostgreSQL connection string
   - `JWT_SECRET`: Random 32+ character string
   - `SECRET`: Random 32+ character string
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
5. Build & Start commands:
   - Build Command: `npx prisma generate && npm test`
   - Start Command: `npm start`

---

## 📄 License
This project is open-source and licensed under the [MIT License](LICENSE).