import Redis from 'ioredis';
import { env } from './env';

/**
 * Cấu hình và kết nối Redis tối ưu cho nhóm 10 người dùng.
 * Phục vụ:
 * 1. Cache báo cáo KPI tuần (giảm tải MySQL khi 10 người cùng truy cập dashboard)
 * 2. Lưu trạng thái phiên & blacklist token tức thời khi đăng xuất/đổi mật khẩu
 * 3. Điểm danh Realtime Presence (biết ai trong 10 người đang online)
 * 4. Khóa phân tán (Distributed Lock) khi nhập liệu bảng Excel tránh ghi đè chéo
 */

let client: Redis | null = null;
let isConnected = false;

if (env.redis.enabled) {
  try {
    client = new Redis({
      host: env.redis.host,
      port: env.redis.port,
      password: env.redis.password,
      db: env.redis.db,
      keyPrefix: env.redis.keyPrefix,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      connectTimeout: 5000,
      keepAlive: 10000,
      // Cấu hình connection pool & retry chiến lược cho nhóm 10 users
      retryStrategy(times) {
        const delay = Math.min(times * 100, 2000);
        return delay;
      },
    });

    client.on('connect', () => {
      isConnected = true;
      console.log(`[Redis] Đã kết nối thành công tới ${env.redis.host}:${env.redis.port} (Tối ưu cho ${env.redis.maxUsers} users)`);
    });

    client.on('error', (err) => {
      isConnected = false;
      console.warn('[Redis] Cảnh báo kết nối:', err.message);
    });

    client.on('close', () => {
      isConnected = false;
    });
  } catch (err) {
    console.warn('[Redis] Không thể khởi tạo Redis client:', (err as Error).message);
    client = null;
  }
}

export const redis = client;
export const isRedisReady = () => isConnected && client?.status === 'ready';

/* -------------------------- 1. Cache helpers -------------------------- */

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!isRedisReady() || !client) return null;
  try {
    const data = await client.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
  if (!isRedisReady() || !client) return;
  try {
    await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err) {
    console.warn('[Redis] cacheSet lỗi:', (err as Error).message);
  }
}

export async function cacheDel(key: string): Promise<void> {
  if (!isRedisReady() || !client) return;
  try {
    await client.del(key);
  } catch (err) {
    console.warn('[Redis] cacheDel lỗi:', (err as Error).message);
  }
}

export async function invalidateWeekCache(weekId: number): Promise<void> {
  if (!isRedisReady() || !client) return;
  try {
    const keys = await client.keys(`${env.redis.keyPrefix}week:${weekId}:*`);
    if (keys.length > 0) {
      // ioredis keys() includes keyPrefix, so remove keyPrefix when passing to del() if client already has keyPrefix
      const rawKeys = keys.map((k) => k.replace(new RegExp(`^${env.redis.keyPrefix}`), ''));
      await client.del(...rawKeys);
    }
  } catch (err) {
    console.warn('[Redis] Invalidate cache lỗi:', (err as Error).message);
  }
}

/* -------------------------- 2. Token Blacklist & Session ------------------ */

export async function blacklistToken(tokenHash: string, ttlSeconds = 7 * 86400): Promise<void> {
  if (!isRedisReady() || !client) return;
  try {
    await client.set(`bl:${tokenHash}`, '1', 'EX', ttlSeconds);
  } catch {
    // Graceful fallback
  }
}

export async function isTokenBlacklisted(tokenHash: string): Promise<boolean> {
  if (!isRedisReady() || !client) return false;
  try {
    const exists = await client.exists(`bl:${tokenHash}`);
    return exists === 1;
  } catch {
    return false;
  }
}

/* -------------------------- 3. Điểm danh Presence (10 users) ------------ */

export interface OnlineUserPresence {
  id: number;
  name: string;
  role: string;
  lastSeen: number;
}

export async function recordUserPresence(user: { id: number; name: string; role: string }): Promise<void> {
  if (!isRedisReady() || !client) return;
  try {
    const payload: OnlineUserPresence = {
      id: user.id,
      name: user.name,
      role: user.role,
      lastSeen: Date.now(),
    };
    // Lưu presence với TTL 2 phút
    await client.set(`presence:user:${user.id}`, JSON.stringify(payload), 'EX', 120);
  } catch {
    // Ignore error
  }
}

export async function getOnlineUsers(): Promise<OnlineUserPresence[]> {
  if (!isRedisReady() || !client) return [];
  try {
    const keys = await client.keys(`${env.redis.keyPrefix}presence:user:*`);
    if (keys.length === 0) return [];
    const rawKeys = keys.map((k) => k.replace(new RegExp(`^${env.redis.keyPrefix}`), ''));
    const items = await client.mget(...rawKeys);
    return items
      .filter((i): i is string => !!i)
      .map((i) => JSON.parse(i) as OnlineUserPresence)
      .sort((a, b) => b.lastSeen - a.lastSeen);
  } catch {
    return [];
  }
}

/* -------------------------- 4. Khóa chỉnh sửa sheet tránh xung đột ------ */

export async function acquireSheetLock(
  weekId: number,
  sheetKey: string,
  user: { id: number; name: string },
  lockSeconds = 45,
): Promise<{ acquired: boolean; lockedBy?: string }> {
  if (!isRedisReady() || !client) return { acquired: true };
  const key = `lock:sheet:${weekId}:${sheetKey}`;
  const payload = JSON.stringify({ userId: user.id, name: user.name, lockedAt: Date.now() });
  try {
    // NX: Set if Not eXists
    const result = await client.set(key, payload, 'EX', lockSeconds, 'NX');
    if (result === 'OK') {
      return { acquired: true };
    }
    // Đã có người giữ lock
    const current = await client.get(key);
    if (current) {
      const parsed = JSON.parse(current);
      if (parsed.userId === user.id) {
        // Cùng người đang sửa, gia hạn lock
        await client.expire(key, lockSeconds);
        return { acquired: true };
      }
      return { acquired: false, lockedBy: parsed.name };
    }
    return { acquired: true };
  } catch {
    return { acquired: true };
  }
}

export async function releaseSheetLock(weekId: number, sheetKey: string, userId: number): Promise<void> {
  if (!isRedisReady() || !client) return;
  const key = `lock:sheet:${weekId}:${sheetKey}`;
  try {
    const current = await client.get(key);
    if (current) {
      const parsed = JSON.parse(current);
      if (parsed.userId === userId) {
        await client.del(key);
      }
    }
  } catch {
    // Ignore error
  }
}
