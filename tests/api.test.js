const request = require('supertest');
const app = require('../app');

describe('DevLog API & Security Test Suite', () => {
    let adminToken;
    let memberToken;
    let userToken;

    beforeAll(async () => {
        // Authenticate admin
        const adminRes = await request(app)
            .post('/auth/token')
            .send({ email: 'admin@devlog.com', password: 'admin1234' });
        adminToken = adminRes.body.token;

        // Authenticate member
        const memberRes = await request(app)
            .post('/auth/token')
            .send({ email: 'demo@devlog.com', password: 'demo1234' });
        memberToken = memberRes.body.token;

        // Register and authenticate regular guest/user
        await request(app)
            .post('/register')
            .send({
                username: 'reg_user',
                email: 'user@devlog.com',
                password: 'user123456',
                confirmPassword: 'user123456'
            });

        const userRes = await request(app)
            .post('/auth/token')
            .send({ email: 'user@devlog.com', password: 'user123456' });
        userToken = userRes.body.token;
    });

    describe('1. Security Headers & Rate Limiting', () => {
        it('includes standard security headers via Helmet', async () => {
            const res = await request(app).get('/api/posts');
            expect(res.headers['x-content-type-options']).toBe('nosniff');
        });

        it('includes standard RateLimit headers on authentication endpoints', async () => {
            const res = await request(app)
                .post('/auth/token')
                .send({ email: 'invalid@devlog.com', password: 'wrong' });
            expect(res.status).toBe(401);
            expect(res.headers['ratelimit-limit']).toBeDefined();
            expect(res.headers['ratelimit-remaining']).toBeDefined();
        });
    });

    describe('2. RBAC & Data Redaction', () => {
        it('redacts author attribution for unauthenticated guest requests on GET /api/posts', async () => {
            const res = await request(app).get('/api/posts');
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.length).toBeGreaterThan(0);
            res.body.forEach(post => {
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

    describe('3. Draft Lifecycle & Moderation Workflow', () => {
        let createdDraftId;

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
            const found = res.body.some(p => p.id === createdDraftId);
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
            expect(res.body.message || res.body.error).toMatch(/admin/i);
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
            const found = res.body.some(p => p.id === createdDraftId);
            expect(found).toBe(true);
        });

        it('allows Admin to unpublish post back to draft', async () => {
            const res = await request(app)
                .patch(`/api/posts/${createdDraftId}/publish`)
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
            expect(res.body.isPublished).toBe(false);
        });

        it('allows Admin to delete post', async () => {
            const res = await request(app)
                .delete(`/api/posts/${createdDraftId}`)
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
            expect(res.body.message).toMatch(/deleted/i);
        });
    });

    describe('4. Team Creation & Password Management', () => {
        let createdTeamId;

        it('lists teams without exposing their passwords to public/guests', async () => {
            const res = await request(app).get('/api/teams');
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            res.body.forEach(team => {
                expect(team.password).toBeUndefined();
                expect(team.name).toBeDefined();
            });
        });

        it('allows authenticated user to create a new team and set password', async () => {
            const res = await request(app)
                .post('/api/teams')
                .set('Authorization', `Bearer ${userToken}`)
                .send({
                    name: 'Payments SRE Team',
                    description: 'Reliability and incident response for checkout',
                    password: 'payments_secret_pass'
                });
            expect(res.status).toBe(201);
            expect(res.body.team.name).toBe('Payments SRE Team');
            expect(res.body.team.id).toBeDefined();
            createdTeamId = res.body.team.id;
        });

        it('rejects joining with incorrect password', async () => {
            const res = await request(app)
                .post(`/api/teams/${createdTeamId}/join`)
                .set('Authorization', `Bearer ${memberToken}`)
                .send({ password: 'wrong_password_123' });
            expect(res.status).toBe(403);
            expect(res.body.error).toMatch(/incorrect/i);
        });

        it('allows user to join with the correct team password', async () => {
            const res = await request(app)
                .post(`/api/teams/${createdTeamId}/join`)
                .set('Authorization', `Bearer ${memberToken}`)
                .send({ password: 'payments_secret_pass' });
            expect(res.status).toBe(200);
            expect(res.body.message).toMatch(/joined/i);
        });

        it('allows team creator to update team password', async () => {
            const res = await request(app)
                .patch(`/api/teams/${createdTeamId}/password`)
                .set('Authorization', `Bearer ${userToken}`)
                .send({ password: 'new_sre_secret_2026' });
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
});
