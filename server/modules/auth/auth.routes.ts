import { Router, type Response } from 'express';
import { z } from 'zod';
import { env } from '../../config/env';
import { authenticate } from '../../middleware/auth';
import { simpleRateLimit } from '../../middleware/rate-limit';
import { login, logout, refresh, REFRESH_COOKIE, type Session } from './auth.service';

export const authRouter = Router();

const cookieOptions = {
  httpOnly: true,
  secure: env.production,
  sameSite: 'strict' as const,
  path: '/api/auth',
  maxAge: 7 * 86_400_000,
};

// Chống dò mật khẩu
authRouter.use(simpleRateLimit({ windowMs: 15 * 60_000, maxRequests: 60 }));

function sendSession(res: Response, session: Session): void {
  res.cookie(REFRESH_COOKIE, session.refreshToken, cookieOptions);
  res.json({ accessToken: session.accessToken, user: session.user });
}

const loginBody = z.object({ email: z.string().min(1), password: z.string().min(1) });

authRouter.post('/login', async (req, res) => {
  const { email, password } = loginBody.parse(req.body);
  sendSession(res, await login(email, password));
});

authRouter.post('/refresh', async (req, res) => {
  sendSession(res, await refresh(req.cookies[REFRESH_COOKIE]));
});

authRouter.post('/logout', async (req, res) => {
  await logout(req.cookies[REFRESH_COOKIE]);
  res.clearCookie(REFRESH_COOKIE, cookieOptions);
  res.sendStatus(204);
});

authRouter.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});
