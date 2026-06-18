const passport = require('passport');

// For session protected routes
function requireSession(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ message: 'Please login first.' });
}

// For JWT protected routes
function requireJWT(req, res, next) {
    passport.authenticate('jwt', { session: false })(req, res, next);
}

// For member only routes
function requireMember(req, res, next) {
    if (req.user && req.user.isMember) {
        return next();
    }
    res.status(403).json({ message: 'Members only.' });
}

// For admin only routes
function requireAdmin(req, res, next) {
    if (req.user && req.user.isAdmin) {
        return next();
    }
    res.status(403).json({ message: 'Admins only.' });
}

// For routes where auth is optional (visibility changes but not blocked)
function optionalJWT(req, res, next) {
    passport.authenticate('jwt', { session: false }, (err, user) => {
        if (user) req.user = user;
        next();
    })(req, res, next);
}

module.exports = { requireSession, requireJWT, requireMember, requireAdmin, optionalJWT };