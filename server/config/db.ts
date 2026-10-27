import mysql, { type Pool, type PoolConnection, type PoolOptions, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import { env } from './env';

export type Row = RowDataPacket;
export type { PoolConnection, ResultSetHeader };

export const connectionOptions: PoolOptions = {
  host: env.mysql.host,
  port: env.mysql.port,
  user: env.mysql.user,
  password: env.mysql.password,
  charset: 'utf8mb4',
  // Trả DATE/DATETIME dạng chuỗi để không bị lệch múi giờ.
  dateStrings: true,
  decimalNumbers: true,
};

export const pool: Pool = mysql.createPool({
  ...connectionOptions,
  database: env.mysql.database,
  connectionLimit: 10,
});

/** Chạy `fn` trong một transaction; lỗi bất kỳ sẽ rollback toàn bộ. */
export async function withTransaction<T>(fn: (connection: PoolConnection) => Promise<T>): Promise<T> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await fn(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
