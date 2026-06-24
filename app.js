require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const pgSession = require('connect-pg-simple')(session);
const pool = require('./config/database');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
require('./config/passport');

const routes        = require('./routes');
const postRoutes    = require('./routes/posts');
const commentRoutes = require('./routes/comments');
const fileRoutes    = require('./routes/files');
const foldersRouter = require('./routes/folder');

const app = express();  // ← define app first

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(session({
    store: new pgSession({
        pool: pool,
        tableName: 'session',
        createTableIfMissing: true
    }),
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 }
}));
app.use(passport.initialize());
app.use(passport.session());
app.use((req, res, next) => {
    console.log('Session:', req.session);
    console.log('User:', req.user);
    next();
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec)); // ← after app defined

app.use('/api/posts', postRoutes);
app.use('/api/posts/:id/comments', commentRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/folders', foldersRouter);
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

app.listen(3000, () => console.log('Server running on http://localhost:3000'));