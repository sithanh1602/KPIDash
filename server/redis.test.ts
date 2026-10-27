import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  cacheGet,
  cacheSet,
  cacheDel,
  blacklistToken,
  isTokenBlacklisted,
  recordUserPresence,
  getOnlineUsers,
  redis,
} from './config/redis';

test('redis connection and cache operations work properly', async () => {
  if (!redis) return;

  // Đợi Redis kết nối nếu đang kết nối
  if (redis.status !== 'ready') {
    await new Promise<void>((resolve) => {
      redis!.once('ready', () => resolve());
      setTimeout(resolve, 1500);
    });
  }

  try {
    // Set and Get
    await cacheSet('test:kpi:10users', { score: 100, teamSize: 10 }, 30);
    const data = await cacheGet<{ score: number; teamSize: number }>('test:kpi:10users');
    assert.deepEqual(data, { score: 100, teamSize: 10 });

    // Delete
    await cacheDel('test:kpi:10users');
    const deleted = await cacheGet('test:kpi:10users');
    assert.equal(deleted, null);

    // Blacklist
    await blacklistToken('hash_token_sample_123', 60);
    const blacklisted = await isTokenBlacklisted('hash_token_sample_123');
    assert.equal(blacklisted, true);
    const notBlacklisted = await isTokenBlacklisted('non_existent_hash');
    assert.equal(notBlacklisted, false);

    // Presence for 10 users
    await recordUserPresence({ id: 999, name: 'Test Annotator', role: 'annotator' });
    const online = await getOnlineUsers();
    assert.ok(online.some((u) => u.id === 999 && u.name === 'Test Annotator'));
  } finally {
    // Đóng kết nối để test runner kết thúc sạch sẽ
    redis.disconnect();
  }
});
