import request from 'supertest';
import app from '../src/app';

describe('DevLog Production Integration & Security Test Suite', () => {
  let adminToken: string;
  let memberToken: string;
  let userToken: string;

  beforeAll(async () => {
    // Authenticate pre-seeded admin
    const adminRes = await request(app)
      .post('/auth/token')
      .send({ email: 'admin@devlog.com', password: 'admin1234' });
    adminToken = adminRes.body.token;

    // Authenticate pre-seeded member
    const memberRes = await request(app)
      .post('/auth/token')
      .send({ email: 'demo@devlog.com', password: 'demo1234' });
    memberToken = memberRes.body.token;
  });

  describe('1. Security Headers & Rate Limiting', () => {
    it('enforces HTTP security headers via Helmet (nosniff, frameguard config)', async () => {
      const res = await request(app).get('/api/posts');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('enforces RateLimit headers on authentication endpoints to defend against brute force', async () => {
      const res = await request(app)
        .post('/auth/token')
        .send({ email: 'nonexistent@devlog.com', password: 'wrong' });
      expect(res.status).toBe(401);
      expect(res.headers['ratelimit-limit']).toBeDefined();
      expect(res.headers['ratelimit-remaining']).toBeDefined();
    });
  });

  describe('2. Authentication Flow & Token Lifecycle (Zod Validated)', () => {
    it('rejects registration with invalid email format via Zod schema', async () => {
      const res = await request(app)
        .post('/register')
        .send({
          username: 'test_dev',
          email: 'not-an-email',
          password: 'password123',
          confirmPassword: 'password123'
        });
      expect(res.status).toBe(400);
      expect(res.text).toMatch(/invalid email/i);
    });

    it('rejects registration when password is under 8 characters via Zod', async () => {
      const res = await request(app)
        .post('/register')
        .send({
          username: 'test_dev',
          email: 'test@devlog.com',
          password: 'short',
          confirmPassword: 'short'
        });
      expect(res.status).toBe(400);
      expect(res.text).toMatch(/at least 8 characters/i);
    });

    it('rejects registration when passwords do not match via Zod refinement', async () => {
      const res = await request(app)
        .post('/register')
        .send({
          username: 'test_dev',
          email: 'test@devlog.com',
          password: 'validpassword123',
          confirmPassword: 'differentpassword123'
        });
      expect(res.status).toBe(400);
      expect(res.text).toMatch(/passwords do not match/i);
    });

    it('registers a new user successfully and redirects to login (302)', async () => {
      const res = await request(app)
        .post('/register')
        .send({
          username: 'cloud_architect',
          email: 'architect@devlog.com',
          password: 'securePassword2026',
          confirmPassword: 'securePassword2026'
        });
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('/login');
    });

    it('authenticates registered user and issues a signed JWT token', async () => {
      const res = await request(app)
        .post('/auth/token')
        .send({ email: 'architect@devlog.com', password: 'securePassword2026' });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      userToken = res.body.token;
    });

    it('rejects login with invalid credentials with 401', async () => {
      const res = await request(app)
        .post('/auth/token')
        .send({ email: 'architect@devlog.com', password: 'incorrectPassword' });
      expect(res.status).toBe(401);
    });

    it('retrieves user profile via GET /api/me with valid Bearer token', async () => {
      const res = await request(app)
        .get('/api/me')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(200);
      expect(res.body.email).toBe('architect@devlog.com');
      expect(res.body.username).toBe('cloud_architect');
      expect(res.body.isMember).toBe(false);
      expect(res.body.isAdmin).toBe(false);
    });

    it('rejects unauthenticated requests to GET /api/me with 401', async () => {
      const res = await request(app).get('/api/me');
      expect(res.status).toBe(401);
    });

    it('allows refreshing token with updated database roles via POST /auth/refresh', async () => {
      const res = await request(app)
        .post('/auth/refresh')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
    });
  });

  describe('3. Multi-Part File Uploads (Multer & Cloudinary Integration)', () => {
    let uploadedFileId: number;

    it('rejects file upload without an authenticated JWT', async () => {
      const res = await request(app)
        .post('/api/files/upload')
        .attach('file', Buffer.from('mock binary data'), 'architecture.png');
      expect(res.status).toBe(401);
    });

    it('rejects upload when no file payload is attached', async () => {
      const res = await request(app)
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${memberToken}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/no file/i);
    });

    it('rejects unauthorized file extensions (e.g. .exe) via Multer fileFilter', async () => {
      const res = await request(app)
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${memberToken}`)
        .attach('file', Buffer.from('MZ executable code'), 'malware.exe');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Invalid file type/i);
    });

    it('uploads a valid PNG file and stores asset metadata with fallback/Cloudinary URL', async () => {
      const samplePngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
      const res = await request(app)
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${memberToken}`)
        .attach('file', samplePngBuffer, 'system-diagram.png');

      expect(res.status).toBe(201);
      expect(res.body.message).toMatch(/uploaded successfully/i);
      expect(res.body.file).toBeDefined();
      expect(res.body.file.name).toBe('system-diagram.png');
      expect(res.body.file.mimeType).toBe('image/png');
      expect(res.body.file.url).toBeDefined();
      uploadedFileId = res.body.file.id;
    });

    it('lists uploaded files for current authenticated user via GET /api/files', async () => {
      const res = await request(app)
        .get('/api/files')
        .set('Authorization', `Bearer ${memberToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const found = res.body.some((f: any) => f.id === uploadedFileId);
      expect(found).toBe(true);
    });

    it('allows owner or admin to delete uploaded file via DELETE /api/files/:id', async () => {
      const res = await request(app)
        .delete(`/api/files/${uploadedFileId}`)
        .set('Authorization', `Bearer ${memberToken}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/deleted successfully/i);
    });
  });

  describe('4. RBAC & Field-Level Query Redaction', () => {
    it('redacts author attribution for unauthenticated guest requests on GET /api/posts', async () => {
      const res = await request(app).get('/api/posts');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      res.body.forEach((post: any) => {
        expect(post.author).toBeUndefined();
        expect(post.createdAt).toBeUndefined();
        expect(post.title).toBeDefined();
      });
    });

    it('redacts author attribution for guest on GET /api/posts/:id', async () => {
      const res = await request(app).get('/api/posts/1');
      expect(res.status).toBe(200);
      expect(res.body.author).toBeUndefined();
      expect(res.body.createdAt).toBeUndefined();
    });

    it('discloses author attribution for verified Dev Members on GET /api/posts', async () => {
      const res = await request(app)
        .get('/api/posts')
        .set('Authorization', `Bearer ${memberToken}`);
      expect(res.status).toBe(200);
      expect(res.body[0].author).toBeDefined();
      expect(res.body[0].author.username).toBeDefined();
      expect(res.body[0].createdAt).toBeDefined();
    });

    it('discloses author attribution for Admins on GET /api/posts', async () => {
      const res = await request(app)
        .get('/api/posts')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body[0].author).toBeDefined();
      expect(res.body[0].createdAt).toBeDefined();
    });
  });

  describe('5. Draft Lifecycle & Moderation Workflow', () => {
    let createdDraftId: number;

    it('creates a new post in draft status by default (isPublished: false)', async () => {
      const res = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'Automated Test: Architecture Decision Record',
          content: 'Context and alternatives evaluated during test run.'
        });
      expect(res.status).toBe(201);
      expect(res.body.isPublished).toBe(false);
      createdDraftId = res.body.id;
    });

    it('prevents guests from accessing unpublished draft post directly', async () => {
      const res = await request(app).get(`/api/posts/${createdDraftId}`);
      expect(res.status).toBe(404);
    });

    it('allows the author to access their own draft post', async () => {
      const res = await request(app)
        .get(`/api/posts/${createdDraftId}`)
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(createdDraftId);
      expect(res.body.isPublished).toBe(false);
    });

    it('allows admins to retrieve all pending drafts via GET /api/posts?status=draft', async () => {
      const res = await request(app)
        .get('/api/posts?status=draft')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      const found = res.body.some((p: any) => p.id === createdDraftId);
      expect(found).toBe(true);
    });

    it('rejects unauthenticated requests to view drafts', async () => {
      const res = await request(app).get('/api/posts?status=draft');
      expect(res.status).toBe(401);
    });

    it('rejects non-admin publishing attempt with 403', async () => {
      const res = await request(app)
        .patch(`/api/posts/${createdDraftId}/publish`)
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(403);
    });

    it('allows Admin to publish draft via PATCH /api/posts/:id/publish', async () => {
      const res = await request(app)
        .patch(`/api/posts/${createdDraftId}/publish`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.isPublished).toBe(true);
    });

    it('makes post visible in public feed once published', async () => {
      const res = await request(app).get('/api/posts');
      expect(res.status).toBe(200);
      const found = res.body.some((p: any) => p.id === createdDraftId);
      expect(found).toBe(true);
    });

    it('allows Admin to delete post', async () => {
      const res = await request(app)
        .delete(`/api/posts/${createdDraftId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/deleted/i);
    });
  });

  describe('6. Team Creation, Password Protection & Scoping', () => {
    let createdTeamId: number;

    it('lists teams without exposing their passwords to public/guests', async () => {
      const res = await request(app).get('/api/teams');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      res.body.forEach((team: any) => {
        expect(team.password).toBeUndefined();
        expect(team.name).toBeDefined();
      });
    });

    it('allows authenticated user to create a new team and set password', async () => {
      const res = await request(app)
        .post('/api/teams')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Platform Reliability SRE',
          description: 'SRE and distributed observability operations',
          password: 'sre_secret_password'
        });
      expect(res.status).toBe(201);
      expect(res.body.team.name).toBe('Platform Reliability SRE');
      createdTeamId = res.body.team.id;
    });

    it('rejects joining team with incorrect password', async () => {
      const res = await request(app)
        .post(`/api/teams/${createdTeamId}/join`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ password: 'wrong_password_xyz' });
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/incorrect/i);
    });

    it('allows user to join team with correct password and grants membership privileges', async () => {
      const res = await request(app)
        .post(`/api/teams/${createdTeamId}/join`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ password: 'sre_secret_password' });
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/joined/i);
    });

    it('allows team creator to update team password', async () => {
      const res = await request(app)
        .patch(`/api/teams/${createdTeamId}/password`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ password: 'new_sre_vault_pass' });
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/updated/i);
    });

    it('allows member to leave team and revert to guest mode', async () => {
      const res = await request(app)
        .post(`/api/teams/${createdTeamId}/leave`)
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/left/i);
    });
  });

  describe('7. Team Document & Folder Scoping', () => {
    let teamPostId: number;

    it('allows creating a post assigned to a specific engineering team', async () => {
      const res = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          title: 'Kafka Partition Rebalance Strategy',
          content: 'Detailed runbook on handling heavy consumer lag and partitions.',
          teamId: 1
        });
      expect(res.status).toBe(201);
      expect(res.body.teamId).toBe(1);
      teamPostId = res.body.id;
    });

    it('returns team metadata on GET /api/posts/:id', async () => {
      const res = await request(app)
        .get(`/api/posts/${teamPostId}`)
        .set('Authorization', `Bearer ${memberToken}`);
      expect(res.status).toBe(200);
      expect(res.body.teamId).toBe(1);
      expect(res.body.team).toBeDefined();
      expect(res.body.team.name).toBe('Core Engineering');
    });

    it('creates a folder assigned to a team and lists with team metadata', async () => {
      const res = await request(app)
        .post('/api/folders')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          name: 'Core Infra Runbooks',
          teamId: 1
        });
      expect(res.status).toBe(201);
      expect(res.body.teamId).toBe(1);

      const listRes = await request(app)
        .get('/api/folders')
        .set('Authorization', `Bearer ${memberToken}`);
      expect(listRes.status).toBe(200);
      const created = listRes.body.find((f: any) => f.name === 'Core Infra Runbooks');
      expect(created).toBeDefined();
      expect(created.team).toBeDefined();
      expect(created.team.name).toBe('Core Engineering');
    });
  });

  describe('8. Zod Schema Validation Guardrails', () => {
    it('rejects post creation when title or content is empty', async () => {
      const res = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ title: '', content: '' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('rejects folder share link generation with invalid duration format', async () => {
      const res = await request(app)
        .post('/api/folders/1/share')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ duration: '99d' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/one of: 1d, 7d, 30d/i);
    });

    it('rejects team creation with password under 3 characters', async () => {
      const res = await request(app)
        .post('/api/teams')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ name: 'Alpha Team', password: '12' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/at least 3 characters/i);
    });
  });
});
