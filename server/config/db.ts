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

/** Chạy kiểm tra và bổ sung cột nhẹ nhàng khi khởi động */
export async function runAutoMigrations() {
  try {
    const [cols] = await pool.query<Row[]>(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'weeks' AND COLUMN_NAME = 'project_tag'",
    );
    if (cols.length === 0) {
      await pool.query("ALTER TABLE weeks ADD COLUMN project_tag VARCHAR(100) NOT NULL DEFAULT 'VF-ADAS-2026'");
      console.log('✅ [AutoMigration] Đã bổ sung cột weeks.project_tag');
    }

    const [wmJobCode] = await pool.query<Row[]>(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'week_members' AND COLUMN_NAME = 'job_code'",
    );
    if (wmJobCode.length === 0) {
      await pool.query("ALTER TABLE week_members ADD COLUMN job_code VARCHAR(50) NOT NULL DEFAULT ''");
      console.log('✅ [AutoMigration] Đã bổ sung cột week_members.job_code');
    }

    const [wmJobStatus] = await pool.query<Row[]>(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'week_members' AND COLUMN_NAME = 'job_status'",
    );
    if (wmJobStatus.length === 0) {
      await pool.query("ALTER TABLE week_members ADD COLUMN job_status VARCHAR(50) NOT NULL DEFAULT 'Chưa hoàn thành'");
      console.log('✅ [AutoMigration] Đã bổ sung cột week_members.job_status');
    }

    try {
      await pool.query('ALTER TABLE daily_entries DROP CHECK daily_entries_chk_1');
      console.log('✅ [AutoMigration] Đã gỡ bỏ ràng buộc cố định 6 ngày trên daily_entries');
    } catch {
      // Constraint đã được gỡ hoặc không tồn tại
    }
  } catch (e) {
    // Không làm gián đoạn nếu DB chưa sẵn sàng
  }
}

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
