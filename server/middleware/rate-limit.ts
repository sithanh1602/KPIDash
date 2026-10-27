import type { NextFunction, Request, Response } from 'express';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

/** Giới hạn tần suất request theo IP đơn giản, không phụ thuộc thư viện ngoài */
export function simpleRateLimit({ windowMs, maxRequests }: { windowMs: number; maxRequests: number }) {
  const store = new Map<string, RateLimitRecord>();

  // Dọn dẹp định kỳ
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of store.entries()) {
      if (value.resetAt < now) store.delete(key);
    }
  }, windowMs).unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    let record = store.get(ip);
    if (!record || record.resetAt < now) {
      record = { count: 1, resetAt: now + windowMs };
      store.set(ip, record);
      return next();
    }
    record.count += 1;
    if (record.count > maxRequests) {
      res.status(429).json({ error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.' });
      return;
    }
    next();
  };
}
