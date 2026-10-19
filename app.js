require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const pgSession = require('connect-pg-simple')(session);
const pool = require('./config/database');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('./config/passport');

const routes        = require('./routes');
const postRoutes    = require('./routes/posts');
const commentRoutes = require('./routes/comments');
const fileRoutes    = require('./routes/files');
const foldersRouter = require('./routes/folder');
const teamsRouter   = require('./routes/teams');

const app = express();

// Security Headers via Helmet
app.use(helmet({
    contentSecurityPolicy: false,
    frameguard: false
}));

// Rate limiting on authentication and sensitive endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' }
});

app.use('/auth', authLimiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
const sessionOptions = {
    secret: process.env.SECRET || 'devlog-session-secret-key-12345',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 }
};

const dbUrl = process.env.DATABASE_URL || process.env.DB_STRING;
const isDummyLocalhost = !dbUrl || dbUrl.includes('localhost:5432') || dbUrl.includes('127.0.0.1:5432');

if (!isDummyLocalhost) {
    try {
        sessionOptions.store = new pgSession({
            pool: pool,
            tableName: 'session',
            createTableIfMissing: true
        });
    } catch (e) {
        console.warn('[AI Studio] Could not initialize pgSession, falling back to MemoryStore:', e.message);
    }
}

app.use(session(sessionOptions));
app.use(passport.initialize());
app.use(passport.session());
app.use((req, res, next) => {
    if (process.env.NODE_ENV !== 'production' && req.session?.user) {
        console.log('Session:', req.session);
    }
    next();
});

app.use('/app', express.static(path.join(__dirname, 'frontend')));
app.use(express.static(path.join(__dirname, 'frontend')));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/', (req, res) => res.redirect('/index.html'));
app.use('/api/posts', postRoutes);
app.use('/api/posts/:id/comments', commentRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/folders', foldersRouter);
app.use('/api/teams', teamsRouter);
app.use(routes);

app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});
app.use((err, req, res, next) => {
    console.error(err);
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Max 5MB.' });
    }
    if (err.message === 'Invalid file type. Only JPEG, PNG, and PDF are allowed.') {
        return res.status(400).json({ error: err.message });
    }
    if (err.code === 'P2025') {
        return res.status(404).json({ error: 'Record not found' });
    }
    const status = err.status || err.statusCode || 500;
    res.status(status).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message });
});

if (require.main === module) {
    app.listen(3000, '0.0.0.0', () => console.log('Server running on http://localhost:3000'));
}

module.exports = app;