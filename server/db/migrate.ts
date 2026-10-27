import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import { connectionOptions } from '../config/db';
import { env } from '../config/env';

/**
 * npm run db:init
 *  1. Tạo database nếu chưa có
 *  2. Tạo bảng (schema.sql, chạy lại an toàn)
 *  3. Tạo tài khoản Leader từ ADMIN_* trong .env nếu chưa tồn tại
 * Không xóa hay ghi đè dữ liệu có sẵn.
 */
async function main() {
  if (!env.mysql.user) throw new Error('Thiếu MYSQL_USER trong .env');
  const dbName = env.mysql.database;
  if (!/^[A-Za-z0-9_]+$/.test(dbName)) throw new Error('MYSQL_DATABASE chỉ gồm chữ, số và dấu gạch dưới');

  const connection = await mysql.createConnection({ ...connectionOptions, multipleStatements: true } as mysql.ConnectionOptions);
  try {
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await connection.query(`USE \`${dbName}\``);
    const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'schema.sql');
    await connection.query(await readFile(schemaPath, 'utf8'));
    console.log(`✔ Database "${dbName}" và các bảng đã sẵn sàng`);

    const { email, name, password } = env.admin;
    if (!email || password.length < 12) {
      console.log('⚠ Bỏ qua tạo Leader: cần ADMIN_EMAIL và ADMIN_PASSWORD (ít nhất 12 ký tự) trong .env');
      return;
    }
    const [rows] = await connection.query<mysql.RowDataPacket[]>('SELECT id FROM users WHERE email = ?', [email]);
    if (rows.length) {
      console.log(`✔ Tài khoản ${email} đã tồn tại (giữ nguyên mật khẩu)`);
      return;
    }
    await connection.query('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)', [
      name,
      email,
      await bcrypt.hash(password, 12),
      'leader',
    ]);
    console.log(`✔ Đã tạo Leader: ${email}`);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error('✘ db:init thất bại:', error.message);
  process.exit(1);
});
