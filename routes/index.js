const router = require('express').Router();
const passport = require('passport');
const passwordUtils = require('../lib/passwordUtils');
const prisma = require('../config/prisma');
const jwt = require('jsonwebtoken');
const { requireSession, requireJWT, requireMember, requireAdmin } = require('../middlewares/auth');

/**
 * @swagger
 * /register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, email, password, confirmPassword]
 *             properties:
 *               username:
 *                 type: string
 *                 example: pratyush
 *               email:
 *                 type: string
 *                 example: prat@gmail.com
 *               password:
 *                 type: string
 *                 example: 12345678
 *               confirmPassword:
 *                 type: string
 *                 example: 12345678
 *     responses:
 *       302:
 *         description: Redirects to /login on success
 *       400:
 *         description: Validation error
 */
router.post('/register', async (req, res, next) => {
    const { username, email, password, confirmPassword } = req.body;
    if (!username || !email || !password || !confirmPassword) {
        return res.status(400).send('All fields are required.');
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).send('Invalid email format.');
    }
    if (password.length < 8) {
        return res.status(400).send('Password must be at least 8 characters.');
    }
    if (password !== confirmPassword) {
        return res.status(400).send('Passwords do not match.');
    }
    try {
        const { hash } = await passwordUtils.genPassword(password);
        await prisma.user.create({
            data: { username, email, hash, isMember: false, isAdmin: false }
        });
        res.redirect('/login');
    } catch (err) {
        next(err);
    }
});

/**
 * @swagger
 * /login:
 *   post:
 *     summary: Login with session (form-based)
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: prat@gmail.com
 *               password:
 *                 type: string
 *                 example: 12345678
 *     responses:
 *       302:
 *         description: Redirects to /login-success or /login-failure
 */
router.post('/login', passport.authenticate('local', {
    failureRedirect: '/login-failure',
    successRedirect: '/login-success'
}));

/**
 * @swagger
 * /logout:
 *   post:
 *     summary: Logout and destroy session
 *     tags: [Auth]
 *     security: []
 *     responses:
 *       302:
 *         description: Redirects to /login
 */
router.post('/logout', (req, res, next) => {
    req.logout(err => {
        if (err) return next(err);
        req.session.destroy(err => {
            if (err) return next(err);
            res.clearCookie('connect.sid');
            res.redirect('/login');
        });
    });
});

/**
 * @swagger
 * /auth/token:
 *   post:
 *     summary: Login and get JWT token
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 example: prat@gmail.com
 *               password:
 *                 type: string
 *                 example: 12345678
 *     responses:
 *       200:
 *         description: Returns JWT token
 *       401:
 *         description: Invalid credentials
 */
router.post('/auth/token', passport.authenticate('local', { session: false }), (req, res) => {
    const payload = {
        id: req.user.id,
        email: req.user.email,
        isMember: req.user.isMember,
        isAdmin: req.user.isAdmin
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.json({ token });
});

/**
 * @swagger
 * /auth/join:
 *   post:
 *     summary: Enter member passcode to become a team member
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               passcode:
 *                 type: string
 *                 example: devteam123
 *     responses:
 *       200:
 *         description: You are now a member
 *       403:
 *         description: Wrong passcode
 */
router.post('/auth/join', requireSession, async (req, res, next) => {
    const { passcode } = req.body;
    if (passcode !== process.env.MEMBER_PASSCODE) {
        return res.status(403).json({ message: 'Wrong passcode.' });
    }
    try {
        await prisma.user.update({
            where: { id: req.user.id },
            data: { isMember: true }
        });
        res.json({ message: 'You are now a member!' });
    } catch (err) {
        next(err);
    }
});

/**
 * @swagger
 * /auth/admin:
 *   post:
 *     summary: Enter admin passcode to become an admin
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               passcode:
 *                 type: string
 *                 example: devadmin123
 *     responses:
 *       200:
 *         description: You are now an admin
 *       403:
 *         description: Wrong passcode
 */
router.post('/auth/admin', requireSession, async (req, res, next) => {
    const { passcode } = req.body;
    if (passcode !== process.env.ADMIN_PASSCODE) {
        return res.status(403).json({ message: 'Wrong passcode.' });
    }
    try {
        await prisma.user.update({
            where: { id: req.user.id },
            data: { isAdmin: true }
        });
        res.json({ message: 'You are now an admin!' });
    } catch (err) {
        next(err);
    }
});

/**
 * @swagger
 * /api/me:
 *   get:
 *     summary: Get current logged in user info
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user info
 *       401:
 *         description: Unauthorized
 */
router.get('/api/me', requireJWT, (req, res) => {
    res.json({
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        isMember: req.user.isMember,
        isAdmin: req.user.isAdmin
    });
});

/**
 * @swagger
 * /public/share/{token}:
 *   get:
 *     summary: Access a shared folder via token (no auth required)
 *     tags: [Share]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Share link token
 *     responses:
 *       200:
 *         description: Folder name and files
 *       404:
 *         description: Share link not found
 *       410:
 *         description: Share link has expired
 */
router.get('/public/share/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const shareLink = await prisma.shareLink.findUnique({ where: { token } });
        if (!shareLink) return res.status(404).json({ error: 'Share link not found' });
        if (shareLink.expiresAt < new Date()) return res.status(410).json({ error: 'Share link has expired' });
        const folder = await prisma.folder.findUnique({
            where: { id: shareLink.folderId },
            include: { files: true }
        });
        res.json({
            folderName: folder.name,
            files: folder.files.map(file => ({
                name: file.name,
                size: file.size,
                url: file.url
            }))
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/', (req, res) => {
    res.send('<h1>Home</h1><p>Please <a href="/register">register</a></p>');
});

router.get('/login', (req, res) => {
    const form = `
    <h1>Login Page</h1>
    <form method="POST" action="/login">
        Email:<br><input type="email" name="email">
        <br>Password:<br><input type="password" name="password">
        <br><br><input type="submit" value="Login">
    </form>`;
    res.send(form);
});

router.get('/register', (req, res) => {
    const form = `
    <h1>Register Page</h1>
    <form method="POST" action="/register">
        Username:<br><input type="text" name="username"><br>
        Email:<br><input type="email" name="email"><br>
        Password:<br><input type="password" name="password"><br>
        Confirm Password:<br><input type="password" name="confirmPassword"><br>
        <br><input type="submit" value="Register">
    </form>`;
    res.send(form);
});

router.get('/protected-route', (req, res) => {
    if (req.isAuthenticated()) {
        res.send(`
            <h1>You are authenticated</h1>
            <form method="POST" action="/logout">
                <button type="submit">Logout</button>
            </form>
        `);
    } else {
        res.send('<h1>You are not authenticated</h1><p><a href="/login">Login</a></p>');
    }
});

router.get('/login-success', (req, res) => {
    res.send('<p>You successfully logged in. --> <a href="/protected-route">Go to protected route</a></p>');
});

router.get('/login-failure', (req, res) => {
    res.send('Invalid email or password.');
});

module.exports = router;