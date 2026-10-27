import 'dotenv/config';

/** Đọc và kiểm tra biến môi trường một lần, các nơi khác chỉ import `env`. */

const production = process.env.NODE_ENV === 'production';

function text(name: string, fallback = ''): string {
  return (process.env[name] ?? fallback).trim();
}

export const env = {
  production,
  port: Number(text('PORT', '3001')),
  mysql: {
    host: text('MYSQL_HOST', '127.0.0.1'),
    port: Number(text('MYSQL_PORT', '3306')),
    database: text('MYSQL_DATABASE', 'anno_kpi_v2'),
    user: text('MYSQL_USER'),
    password: process.env.MYSQL_PASSWORD ?? '',
  },
  jwt: {
    accessSecret: text('JWT_ACCESS_SECRET'),
    refreshSecret: text('JWT_REFRESH_SECRET'),
  },
  admin: {
    email: text('ADMIN_EMAIL'),
    name: text('ADMIN_NAME', 'Team Lead'),
    password: process.env.ADMIN_PASSWORD ?? '',
  },
  redis: {
    enabled: text('REDIS_ENABLED', 'true') === 'true',
    host: text('REDIS_HOST', '127.0.0.1'),
    port: Number(text('REDIS_PORT', '6379')),
    password: text('REDIS_PASSWORD') || undefined,
    db: Number(text('REDIS_DB', '0')),
    keyPrefix: text('REDIS_KEY_PREFIX', 'annokpi:'),
    maxUsers: Number(text('REDIS_MAX_USERS', '10')),
  },
};

/** Gọi khi khởi động server: dừng sớm nếu thiếu cấu hình bảo mật. */
export function assertServerConfig(): void {
  const { accessSecret, refreshSecret } = env.jwt;
  if (accessSecret.length < 32 || refreshSecret.length < 32 || accessSecret === refreshSecret) {
    throw new Error('JWT_ACCESS_SECRET và JWT_REFRESH_SECRET phải khác nhau và dài ít nhất 32 ký tự (xem .env.example).');
  }
  if (!env.mysql.user) throw new Error('Thiếu MYSQL_USER trong .env');
}
