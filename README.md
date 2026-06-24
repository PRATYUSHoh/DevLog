DevLog

It's an internal knowledge base for dev teams. Engineers document decisions and upload assets. Access is role-gated — guests see public docs, team members see full attribution, admins moderate. I built role-based visibility at the query level using Prisma select, JWT auth, and time-expiring share links for external asset sharing

 🛠️ Tech Stack & Architecture

- **Runtime Environment:** Node.js, Express
- **Database & ORM:** PostgreSQL, Prisma ORM
- **Authentication & Security:** 
  - Passport.js (Local Session Strategy for administrative flows)
  - JSON Web Tokens (JWT) for stateless, secure `/api/*` requests
  - Password hashing with `bcrypt`
- **Asset Storage & Processing:** Multer (memory buffer storage), Cloudinary SDK (stream upload engine)
- **Session Store:** PostgreSQL-backed sessions using `connect-pg-simple`

---

👥 Dynamic Role-Based Access Control

DevLog implements **three primary roles** with custom visibility levels:

| Role | Permissions & Visibility | Upgrading Route |
| :--- | :--- | :--- |
| **Guest** | Can read published posts and comments. **Author attribution and timestamps are scrubbed** at the database layer. | *Default role upon registration* |
| **Member** | Sees **full author attribution**, can create posts (as drafts), upload files, write comments, and share assets. | Enter passcode at `POST /auth/join` |
| **Admin** | Possesses full moderation rights. Can publish/unpublish posts, delete comments, and scrub files. | Enter passcode at `POST /auth/admin` |

---

 🗄️ Database Schema Design (Prisma)

Built on **PostgreSQL** and modeled with **Prisma** (`prisma/schema.prisma`):

```
       +-----------------------+
       |         User          |
       +-----------------------+
       | id (PK)               | <----+
       | username (Unique)     |      |
       | email (Unique)        |      |
       | hash                  |      |
       | isMember (Boolean)    |      |
       | isAdmin (Boolean)     |      |
       +-----------------------+      |
         |         |         |        |
         | (1)     | (1)     | (1)    |
         v (N)     v (N)     v (N)    |
   +----------+  +----------+ +------+----+
   |   Post   |  | Comment  | |   File    |
   +----------+  +----------+ +-----------+
   | id (PK)  |  | id (PK)  | | id (PK)   |
   | title    |  | text     | | name      |
   | content  |  | postId   | | size      |
   | isPub.   |  | authorId | | mimeType  |
   | authorId |  +----------+ | url       |
   +----------+               | publicId  |
         | (1)                | postId?   | --+
         v (N)                | folderId? | --|--+
   +----------+               | uploadedBy| --+  |
   |   File   |               +-----------+      |
   +----------+                                  |
                                                 |
         +---------------------------------------+
         |
         v
   +-----------+          +---------------+
   |  Folder   | (1)  (N) |   ShareLink   |
   +-----------+ -------- |---------------+
   | id (PK)   |          | id (PK)       |
   | name      |          | token (Unique)|
   | userId    |          | expiresAt     |
   +-----------+          +---------------+
```

⚙️ Hybrid Authentication Flow

DevLog implements a highly secure, hybrid stateful-stateless authentication mechanism:

```
[Client] ---> Credentials (email/password) ---> POST /login ---> [Express Backend]
                                                                      |
                     Hash Verification (bcrypt) <---------------------+
                                      |
                 +--------------------+--------------------+
                 | (Session-based)                         | (Token-based)
                 v                                         v
         Create Session (PG Table)                 Sign Bearer JWT
         Set Cookie                                Return JWT + User Payload
```

 🔑 Key Engineering & Architectural Concepts

1. Database-Level Role Projection (Prisma Select)
Instead of fetching full database objects and filtering them in Node.js memory (which is inefficient and prone to memory leaks or developer oversight), DevLog leverages **Prisma projection filters** (`select` blocks) dynamically built based on the user's role:

```// Example visibility projection logic
const getPostProjection = (isMember: boolean, isAdmin: boolean) => {
  return {
    id: true,
    title: true,
    content: true,
    isPublished: true,
    // Attribute fields are only queried if user is a verified Member or Admin
    ...(isMember || isAdmin ? {
      createdAt: true,
      updatedAt: true,
      author: {
        select: { id: true, username: true, email: true }
      }
    } : {})
  };
};
```

 2. Hybrid Auths & Stateless JWT Flags
DevLog includes a secure double-layered auth strategy:
- **Session Auth:** Standard session cookies stored in PostgreSQL via `connect-pg-simple` for the web administration login.
- **Stateless JWT Auth:** Client requests include a JWT in the `Authorization: Bearer <token>` header. For efficiency, role flags (`isMember`, `isAdmin`) are embedded in the signed JWT payload. This allows downstream middleware to verify authorization instantly without hitting the database for every single request.

3. Graceful Public Access (`optionalJWT` Middleware)
Routes like `GET /api/posts` must support both registered Members and unauthenticated Guests. DevLog uses a smart custom `optionalJWT` middleware:
- If a valid token is provided, it populates `req.user` with role flags (`isMember`, `isAdmin`).
- If no token (or an expired token) is provided, it lets the request pass but leaves `req.user` undefined, defaulting the downstream controller to "Guest" visibility rules.

4. Memory-Buffered Cloudinary Uploads
To prevent disk space exhaustion attacks, Multer is configured to use memory storage buffers. Files are streamed directly to Cloudinary using their SDK's writable streams, avoiding any local file creation in the container.
```javascript
// Express upload stream pipe
const uploadStream = cloudinary.uploader.upload_stream(
  { folder: "devlog_assets" },
  (error, result) => {
    if (error) return res.status(500).json({ error: "Upload failed" });
    // Save result.secure_url and result.public_id to PostgreSQL via Prisma
  }
);
streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
```

### 5. Time-Expiring Secure Share Links (UUID Tokens)
Engineers can group assets into folders and generate pre-signed access tokens with a strict expiration duration (`1d`, `7d`, or `30d`). 
- On request, a UUID token is minted and saved in the DB alongside an explicit `expiresAt` timestamp.
- When an external visitor attempts to fetch the files via `/public/share/:token`, the server performs a timestamp comparison. If expired, the route returns `410 Gone` and does not query the files.

---

## 🗺️ API Route Reference

### 🔐 Authentication & Role Upgrades
| Method | Endpoint | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/register` | None | Register a new user account (defaults to Guest) |
| `POST` | `/auth/token` | None (Local Creds) | Logs in user and returns a signed JWT |
| `POST` | `/auth/join` | JWT (Guest/Member) | Enter team passcode to upgrade account to **Member** (`isMember = true`) |
| `POST` | `/auth/admin` | JWT (Guest/Member) | Enter admin passcode to upgrade account to **Admin** (`isAdmin = true`) |
| `GET` | `/api/me` | JWT | Get authenticated profile info |

### 📝 Decision Log Posts (Knowledge Base)
| Method | Endpoint | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/posts` | None / `optionalJWT` | Get all published posts. Guest view gets scrubbed info; Member/Admin gets full attribution. |
| `GET` | `/api/posts/:id` | None / `optionalJWT` | Get single post details. Dynamic role-based field scrubbing. |
| `POST` | `/api/posts` | JWT (Member/Admin) | Create a new post (always starts as a draft) |
| `PUT` | `/api/posts/:id` | JWT (Author only) | Edit existing post |
| `DELETE` | `/api/posts/:id` | JWT (Admin only) | Permanently delete a post and scrub metadata |
| `PATCH` | `/api/posts/:id/publish`| JWT (Admin only) | Toggle published status (`isPublished = true/false`) |

### 💬 Post Comments & Discussions
| Method | Endpoint | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/posts/:id/comments` | None / `optionalJWT`| Fetch comments for a post. Members see authors; Guests see anonymous tags. |
| `POST` | `/api/posts/:id/comments` | JWT (Member/Admin) | Post a comment on a team decision |
| `DELETE` | `/api/comments/:id` | JWT (Admin only) | Delete an inappropriate comment |

### 📁 Asset Management & Folders
| Method | Endpoint | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/files/upload` | JWT (Member/Admin) | Upload an asset (JPEG, PNG, or PDF; max 5MB) to Cloudinary |
| `GET` | `/api/files` | JWT (Member/Admin) | List all files uploaded by current user |
| `GET` | `/api/files/:id` | JWT (Member/Admin) | Fetch meta details of a specific file |
| `DELETE` | `/api/files/:id` | JWT (Owner or Admin) | Delete a file from database and trigger purge in Cloudinary |
| `POST` | `/api/folders` | JWT (Member/Admin) | Create an asset folder |
| `GET` | `/api/folders` | JWT (Member/Admin) | Get all directories (returns nested child file counts) |
| `PUT` | `/api/folders/:id` | JWT (Owner only) | Rename or edit folder |
| `DELETE` | `/api/folders/:id` | JWT (Owner only) | Delete empty folder |

### 🔗 Public Shared Vaults
| Method | Endpoint | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/folders/:id/share`| JWT (Owner only) | Generates a shared link. Body: `{ duration: "1d" \| "7d" \| "30d" }` |
| `GET` | `/public/share/:token` | None | Returns shared files. **Fails with 410 Gone if expired.** |

---

## 🗄️ Database Schema Design (Prisma)

Below is the structured relational architecture managing authentication, roles, nested files, and expiring links:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id        String    @id @default(uuid())
  username  String    @unique
  email     String    @unique
  password  String
  isMember  Boolean   @default(false)
  isAdmin   Boolean   @default(false)
  createdAt DateTime  @default(now())

  posts     Post[]
  comments  Comment[]
  folders   Folder[]
  files     File[]
}

model Post {
  id          String    @id @default(uuid())
  title       String
  content     String
  isPublished Boolean   @default(false)
  authorId    String
  author      User      @relation(fields: [authorId], references: [id], onDelete: Cascade)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  comments    Comment[]
}

model Comment {
  id        String   @id @default(uuid())
  content   String
  postId    String
  post      Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  authorId  String
  author    User     @relation(fields: [authorId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
}

model Folder {
  id        String   @id @default(uuid())
  name      String
  ownerId   String
  owner     User     @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  files      File[]
  shareLinks ShareLink[]
}

model File {
  id        String   @id @default(uuid())
  name      String
  url       String
  publicId  String   // Cloudinary secure identification ID for purges
  size      Int
  ownerId   String
  owner     User     @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  folderId  String?
  folder    Folder?  @relation(fields: [folderId], references: [id], onDelete: SetNull)
  createdAt DateTime @default(now())
}

model ShareLink {
  id        String   @id @default(uuid())
  token     String   @unique @default(uuid())
  folderId  String
  folder    Folder   @relation(fields: [folderId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())
}
```

---

## ⚡ Setup & Local Development

### 1. Prerequisites
- Node.js (v18 or higher)
- PostgreSQL database (local or hosted e.g. Railway, Supabase)
- Cloudinary credentials (free tier is fully compatible)

### 2. Environment Variables
Create a `.env` file in the root directory:
```env
PORT=3000
DATABASE_URL="postgresql://user:password@localhost:5432/devlog"
SECRET="your_jwt_secret_key_here"

# passcodes for role upgrades
MEMBER_PASSCODE="team_devlog_2026"
ADMIN_PASSCODE="super_admin_pass"

# Cloudinary credentials (for file assets)
CLOUDINARY_CLOUD_NAME="your_cloud_name"
CLOUDINARY_API_KEY="your_api_key"
CLOUDINARY_API_SECRET="your_api_secret"
```

### 3. Installation & Database Setup
```bash
# Install dependencies
npm install

# Run database migrations
npx prisma migrate dev --name init

# Generate Prisma Client
npx prisma generate
```

### 4. Fire up the Server
```bash
# Start development server
npm run dev
```
The console will boot the server with a live confirmation:
```bash
Server running on http://localhost:3000
```

---

## 🎯 Key Learning & Takeaways

By building **DevLog**, several high-impact backend engineering challenges were overcome:
1. **Dynamic Query Optimization:** Implemented custom field selection directly on PostgreSQL queries to guarantee high-security criteria, ensuring data was never transmitted out of the SQL instance unless authenticated.
2. **Buffer Pipelining Streams:** Handled high-throughput multi-part file uploads safely in Node.js, streaming files to Cloudinary seamlessly without leaving a residual physical footprint on container filesystems.
3. **Session vs Stateless Hybrid Auth:** Successfully designed an architecture where administrative functions utilize safe stateful database sessions, while standard API consumers rely on stateful JWT payloads for frictionless scale.
4. **Active Expirations:** Utilized lazy evaluation on database tokens to maintain pre-signed link validity, avoiding heavy background cron job schedules while returning accurate HTTP error states (`410 Gone`).
