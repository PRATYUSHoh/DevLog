import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import session from 'express-session';
import passport from 'passport';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';

import './config/passport';
import pool from './config/database';
import swaggerSpec from './config/swagger';

import authRouter from './routes/auth';
import postRoutes from './routes/posts';
import commentRoutes from './routes/comments';
import fileRoutes from './routes/files';
import folderRoutes from './routes/folder';
import teamRoutes from './routes/teams';

const app = express();

// Security Headers via Helmet
app.use(helmet({
  contentSecurityPolicy: false,
  frameguard: false
}));

// Rate limiting on authentication endpoints
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

const sessionOptions: session.SessionOptions = {
  secret: process.env.SECRET || 'devlog-session-secret-key-12345',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 }
};

const dbUrl = process.env.DATABASE_URL || process.env.DB_STRING;
const isDummyLocalhost = !dbUrl || dbUrl.includes('localhost:5432') || dbUrl.includes('127.0.0.1:5432');

if (!isDummyLocalhost) {
  try {
    const pgSession = require('connect-pg-simple')(session);
    sessionOptions.store = new pgSession({
      pool: pool,
      tableName: 'session',
      createTableIfMissing: true
    });
  } catch (e: any) {
    console.warn('[DevLog] Could not initialize pgSession, falling back to MemoryStore:', e.message);
  }
}

app.use(session(sessionOptions));
app.use(passport.initialize());
app.use(passport.session());

// Static frontend delivery
const frontendPath = path.resolve(process.cwd(), 'frontend');
app.use('/app', express.static(frontendPath));
app.use(express.static(frontendPath));

// Swagger API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get('/', (_req: Request, res: Response) => res.redirect('/index.html'));

// Mount API Endpoints
app.use('/api/posts', postRoutes);
app.use('/api/posts/:id/comments', commentRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/teams', teamRoutes);
app.use(authRouter);

// 404 Route Catch-All
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Centralized Error Handling
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
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

export default app;
