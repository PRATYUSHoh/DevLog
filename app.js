const express = require('express');
const app = express();
const session = require('express-session');
const passport = require('passport');
const pgSession = require('connect-pg-simple')(session);
const pool = require('./config/database');
require('dotenv').config();
require('./config/passport');

const routes        = require('./routes');
const postRoutes    = require('./routes/posts');
const commentRoutes = require('./routes/comments');
const fileRoutes    = require('./routes/files');
const foldersRouter = require('./routes/folders');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

app.use('/api/posts', postRoutes);
app.use('/api/posts/:id/comments', commentRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/folders', foldersRouter);
app.use(routes);

app.listen(3000, () => console.log('Server running on http://localhost:3000'));