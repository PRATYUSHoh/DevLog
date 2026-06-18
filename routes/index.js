const router = require('express').Router();
const passport = require('passport');
const passwordUtils = require('../lib/passwordUtils');
const prisma = require('../config/prisma');
const jwt = require('jsonwebtoken');
const { requireSession, requireJWT, requireMember, requireAdmin } = require('../middlewares/auth');


/**
 * -------------- POST ROUTES ----------------
 */
router.post('/login', passport.authenticate('local', {
    failureRedirect: '/login-failure',
    successRedirect: '/login-success'
}));

router.post('/register', async (req, res, next) => {
    const { username, email, password, confirmPassword } = req.body;

    // 1. Empty fields check
    if (!username || !email || !password || !confirmPassword) {
        return res.status(400).send('All fields are required.');
    }

    // 2. Email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).send('Invalid email format.');
    }

    // 3. Password min 8 chars
    if (password.length < 8) {
        return res.status(400).send('Password must be at least 8 characters.');
    }

    // 4. Confirm password match
    if (password !== confirmPassword) {
        return res.status(400).send('Passwords do not match.');
    }

    try {
    const { hash } = await passwordUtils.genPassword(password);
    await prisma.user.create({
        data: {
            username,
            email,
            hash,
            isMember: false,
            isAdmin: false
        }
    });
    res.redirect('/login');
} catch (err) {
    next(err);
}});

router.post('/logout', (req, res, next) => {
    req.logout(err => {
        if (err) return next(err);
        req.session.destroy(err => {          // ← properly destroy session
            if (err) return next(err);
            res.clearCookie('connect.sid');   // ← clear cookie from browser
            res.redirect('/login');
        });
    });
});

/**
 * -------------- GET ROUTES ----------------
 */
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




// ─── POST /auth/token → returns JWT ───────────────────────
router.post('/auth/token', passport.authenticate('local', { session: false }), (req, res) => {
    const payload = { id: req.user.id, email: req.user.email,isMember: req.user.isMember,   // ← add this
        isAdmin: req.user.isAdmin  };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.json({ token });
});

// ─── POST /auth/join → become a member ────────────────────
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

// ─── POST /auth/admin → become admin ──────────────────────
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

router.get('/api/me', requireJWT, (req, res) => {
    res.json({ 
        id: req.user.id, 
        username: req.user.username, 
        email: req.user.email,
        isMember: req.user.isMember,
        isAdmin: req.user.isAdmin
    });
});

module.exports = router;