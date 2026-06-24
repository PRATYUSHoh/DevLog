# DevLog

An internal knowledge base for dev teams. Engineers document decisions and upload assets. Access is role-gated — guests see public docs, team members see full attribution, admins moderate. Built role-based visibility at the query level using Prisma select, JWT auth, and time-expiring share links for external asset sharing.

---

## Tech Stack

- **Runtime:** Node.js, Express
- **Database & ORM:** PostgreSQL, Prisma ORM
- **Auth:** Passport.js (Local + JWT), bcrypt, express-session
- **File Storage:** Multer (memoryStorage), Cloudinary SDK
- **Session Store:** PostgreSQL via connect-pg-simple
- **API Docs:** Swagger UI (swagger-jsdoc + swagger-ui-express)

---

## Live API Sandbox

Test all endpoints at: https://devlog-production-a576.up.railway.app/api-docs

1. Register via `POST /register` or get a token via `POST /auth/token`
2. Click the **Authorize** lock icon top right
3. Paste your token (Bearer prefix added automatically)
4. You're authenticated — test any route from the browser

---

## Role-Based Access Control

| Role | How to get it | What they see |
|---|---|---|
| **Guest** | Default on register | Published posts and comments — no author names, no timestamps |
| **Member** | Enter passcode at `POST /auth/join` | Full attribution — who wrote what, when |
| **Admin** | Enter passcode at `POST /auth/admin` | Everything + can publish/delete posts and comments |

---

## Hybrid Authentication Flow
[Client] → Credentials (email/password) → POST /auth/token → [Express Backend]

|

bcrypt.compare() ←--------------------+

|

Sign JWT with payload:

{ id, email, isMember, isAdmin }

|

Return Bearer JWT

Session auth (`/login`) is used for web-based flows.  
JWT auth (`Authorization: Bearer <token>`) is used for all `/api/*` routes.

---

## Key Engineering Concepts

### 1. Database-Level Role Projection (Prisma Select)

Instead of fetching full rows and filtering in Node.js, DevLog uses Prisma `select` blocks built dynamically from the user's role:

```js
const posts = await prisma.post.findMany({
  where: { isPublished: true },
  select: {
    id: true,
    title: true,
    content: true,
    createdAt: isMember,
    author: isMember ? { select: { username: true } } : false,
  },
});
```

Guests never receive author or timestamp fields — they are excluded at the SQL layer, not filtered after the fact.

### 2. optionalJWT Middleware

Public routes like `GET /api/posts` support both guests and members. A custom middleware tries JWT but never blocks:

```js
function optionalJWT(req, res, next) {
    passport.authenticate('jwt', { session: false }, (err, user) => {
        if (user) req.user = user;
        next();
    })(req, res, next);
}
```

If a valid token is present, `req.user` is populated with role flags. If not, `req.user` is undefined and the route defaults to guest visibility.

### 3. Memory-Buffered Cloudinary Uploads

Multer is configured with `memoryStorage` — no files touch disk. The buffer is piped directly to Cloudinary via `upload_stream`:

```js
const uploadToCloudinary = (buffer, filename) => {
    return new Promise((resolve, reject) => {
        const options = {
            resource_type: 'auto',
            folder: 'uploads',
            public_id: crypto.randomBytes(16).toString('hex'),
        };
        const stream = cloudinary.uploader.upload_stream(options,
            (error, result) => {
                if (error) reject(error);
                else resolve(result);
            }
        );
        stream.end(buffer);
    });
};
```

`result.secure_url` and `result.public_id` are saved to PostgreSQL. Deletion calls `cloudinary.uploader.destroy(file.publicId)`.

### 4. Time-Expiring Share Links

Engineers generate UUID tokens with explicit expiry for external asset sharing:

```js
const token = crypto.randomUUID();
const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
```

On access, the server checks `expiresAt < new Date()` and returns `410 Gone` if expired. No cron jobs — lazy evaluation on request.

---

## API Routes

### Auth
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/register` | None | Register with username, email, password |
| POST | `/login` | None | Session login (form-based) |
| POST | `/auth/token` | None | Login and get JWT |
| POST | `/auth/join` | Session | Enter member passcode → isMember: true |
| POST | `/auth/admin` | Session | Enter admin passcode → isAdmin: true |
| GET | `/api/me` | JWT | Get current user info |

### Posts
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/posts` | Optional JWT | List published posts. Members see author + timestamp. |
| GET | `/api/posts/:id` | Optional JWT | Single post. Same visibility logic. |
| POST | `/api/posts` | JWT | Create post (draft by default) |
| PUT | `/api/posts/:id` | JWT (author only) | Edit post |
| DELETE | `/api/posts/:id` | JWT (admin only) | Delete post |
| PATCH | `/api/posts/:id/publish` | JWT (admin only) | Toggle isPublished |

### Comments
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/posts/:id/comments` | Optional JWT | List comments. Members see author names. |
| POST | `/api/posts/:id/comments` | JWT | Add comment |
| DELETE | `/api/comments/:id` | JWT (admin only) | Delete comment |

### Files
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/files/upload` | JWT | Upload JPEG/PNG/PDF (max 5MB) to Cloudinary |
| GET | `/api/files` | JWT | List your uploaded files |
| GET | `/api/files/:id` | JWT | Get file metadata |
| DELETE | `/api/files/:id` | JWT (owner or admin) | Delete from Cloudinary + DB |

### Folders & Share Links
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/folders` | JWT | Create folder |
| GET | `/api/folders` | JWT | List your folders with file count |
| PUT | `/api/folders/:id` | JWT (owner only) | Rename folder |
| DELETE | `/api/folders/:id` | JWT (owner only) | Delete folder + files from Cloudinary |
| POST | `/api/folders/:id/share` | JWT (owner only) | Generate share link (`1d`, `7d`, `30d`) |
| GET | `/public/share/:token` | None | Access shared folder. Returns 410 if expired. |

---

## Database Schema

```prisma
model User {
  id        Int       @id @default(autoincrement())
  username  String    @unique
  email     String    @unique
  hash      String
  isMember  Boolean   @default(false)
  isAdmin   Boolean   @default(false)
  createdAt DateTime  @default(now())
  posts     Post[]
  comments  Comment[]
  files     File[]
}

model Post {
  id          Int       @id @default(autoincrement())
  title       String
  content     String
  isPublished Boolean   @default(false)
  authorId    Int
  createdAt   DateTime  @default(now())
  author      User      @relation(fields: [authorId], references: [id])
  comments    Comment[]
  files       File[]
}

model Comment {
  id        Int      @id @default(autoincrement())
  text      String
  authorId  Int
  postId    Int
  createdAt DateTime @default(now())
  author    User     @relation(fields: [authorId], references: [id])
  post      Post     @relation(fields: [postId], references: [id])
}

model File {
  id         Int      @id @default(autoincrement())
  name       String
  size       Int
  mimeType   String
  url        String
  publicId   String
  postId     Int?
  folderId   Int?
  uploadedBy Int
  createdAt  DateTime @default(now())
  post       Post?    @relation(fields: [postId], references: [id])
  folder     Folder?  @relation(fields: [folderId], references: [id])
  uploader   User     @relation(fields: [uploadedBy], references: [id])
}

model Folder {
  id         Int         @id @default(autoincrement())
  name       String
  userId     Int
  createdAt  DateTime    @default(now())
  files      File[]
  shareLinks ShareLink[]
}

model ShareLink {
  id        Int      @id @default(autoincrement())
  folderId  Int
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
  folder    Folder   @relation(fields: [folderId], references: [id])
}
```

---

## Local Setup

### Prerequisites
- Node.js v18+
- PostgreSQL
- Cloudinary account (free tier works)

### Environment Variables

Create a `.env` file:
DB_STRING=postgresql://user:password@localhost:5432/devlog

DATABASE_URL=postgresql://user:password@localhost:5432/devlog

SECRET=your_session_secret

JWT_SECRET=your_jwt_secret

PORT=3000

MEMBER_PASSCODE=your_member_passcode

ADMIN_PASSCODE=your_admin_passcode

CLOUDINARY_CLOUD_NAME=your_cloud_name

CLOUDINARY_API_KEY=your_api_key

CLOUDINARY_API_SECRET=your_api_secret

### Install & Run

```bash
npm install
npx prisma migrate dev --name init
npx prisma generate
npm run dev
```
Server runs at `http://localhost:3000`  
Swagger docs at `http://localhost:3000/api-docs`

**Live deployment:** https://devlog-production-a576.up.railway.app

---

## Concepts Learned

- Passport.js local strategy + JWT strategy
- bcrypt password hashing
- Prisma relations and dynamic select projections
- Multer memoryStorage + Cloudinary upload_stream
- Role-based access control at the query level
- UUID share tokens with timestamp expiry
- PostgreSQL session storage with connect-pg-simple
- Express global error handling and 404 middleware
- Swagger/OpenAPI documentation with swagger-jsdoc