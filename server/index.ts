import path from 'node:path';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { assertServerConfig, env } from './config/env';
import { errorHandler } from './middleware/errors';
import { authRouter } from './modules/auth/auth.routes';
import { membersRouter } from './modules/members/members.routes';
import { weeksRouter } from './modules/weeks/weeks.routes';
import { usersRouter } from './modules/users/users.routes';
import { pool } from './config/db';

assertServerConfig();

const app = express();

app.use(
  helmet({
    contentSecurityPolicy: env.production
      ? undefined
      : false,
  }),
);
app.use(cookieParser());
app.use(express.json({ limit: '15mb' }));

// Health check
app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, database: 'connected' });
  } catch (error) {
    res.status(503).json({ ok: false, database: 'disconnected', error: (error as Error).message });
  }
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/members', membersRouter);
app.use('/api/weeks', weeksRouter);

// Serve frontend if in production
if (env.production) {
  const distDir = path.resolve('dist');
  app.use(express.static(distDir));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

// Error Handler
app.use(errorHandler);

app.listen(env.port, '0.0.0.0', () => {
  console.log(`🚀 Server đang chạy tại http://localhost:${env.port}`);
});
