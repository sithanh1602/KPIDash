#!/bin/sh
set -e

# Đợi MySQL sẵn sàng nếu có cấu hình MYSQL_HOST
if [ -n "$MYSQL_HOST" ]; then
  echo "⏳ Đang đợi MySQL ($MYSQL_HOST:${MYSQL_PORT:-3306}) sẵn sàng..."
  for i in $(seq 1 30); do
    if node -e "const net = require('net'); const s = net.createConnection({ host: process.env.MYSQL_HOST, port: Number(process.env.MYSQL_PORT || 3306) }, () => { s.end(); process.exit(0); }); s.on('error', () => process.exit(1));" 2>/dev/null; then
      echo "✔ MySQL đã sẵn sàng kết nối!"
      break
    fi
    sleep 2
  done
fi

# Tự động khởi tạo schema bảng và tài khoản Leader nếu chưa có
echo "⏳ Đang đồng bộ database (npm run db:init)..."
npm run db:init || echo "⚠ Cảnh báo: db:init chưa thể hoàn tất ngay, sẽ tiếp tục khởi động..."

echo "🚀 Bắt đầu chạy KPI Dashboard..."
exec "$@"
