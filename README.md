# Anno — KPI & Quality Dashboard (3D LiDAR)

Hệ thống Dashboard theo dõi hiệu suất (KPI) & kiểm soát chất lượng (QA/QC) gán nhãn dữ liệu 3D LiDAR (Vinfast Team T01).
Được thiết kế hiện đại, hỗ trợ đầy đủ 6 màn hình báo cáo, nhập liệu trực tiếp bằng bảng Excel trên web, import/export file Excel (.xlsx), CSV và PDF.

---

## 1. Công nghệ sử dụng

- **Frontend**: React 19, TypeScript (`.tsx`), Vite 6, Tailwind CSS, HeroUI, Lucide Icons.
- **Backend**: Node.js (TypeScript qua `tsx`), Express 5, MySQL 8 (`mysql2/promise`), JWT + HttpOnly Cookie.
- **Bảng tính & Báo cáo**: ExcelJS (đọc/ghi file .xlsx đa sheet có định dạng màu và công thức), CSV parser UTF-8 BOM.

---

## 2. Cấu trúc thư mục

```text
dashboardKPIdashboardKPI/
├── shared/                         # Logic & kiểu dữ liệu dùng chung (Server & Client)
│   ├── types.ts                    # Toàn bộ Type definitions (WeekMeta, WeekReport, SheetRow...)
│   ├── constants.ts                # Ngưỡng KPI (1.000 / 1.200), mã màu QA (S, K, Z, H, O, D)
│   ├── cell.ts                     # Parser ô sản lượng: số, ước tính (*), Nghỉ, Done job
│   ├── format.ts                   # Định dạng số, chuỗi ngày, nhãn tuần kiểu Việt Nam
│   ├── kpi.ts                      # Bộ công thức tính KPI, xếp hạng, tóm tắt điều hành
│   ├── sheets.ts                   # Định nghĩa 7 bảng Excel web (cột, kiểu, nhãn, gợi ý)
│   └── report-sections.ts          # Định nghĩa 6 phần báo cáo phục vụ xuất file
├── server/                         # Backend Express + MySQL
│   ├── config/                     # env.ts, db.ts (Connection pool & transaction helper)
│   ├── db/
│   │   ├── schema.sql              # DDL MySQL 8 (users, weeks, daily_entries, qa_results...)
│   │   ├── migrate.ts              # Khởi tạo DB & tạo Leader (npm run db:init)
│   │   └── sample-data.ts          # Nạp số liệu thực từ 6 ảnh mẫu (npm run db:sample)
│   ├── middleware/                 # auth.ts (JWT), rate-limit.ts, errors.ts
│   ├── modules/
│   │   ├── auth/                   # Đăng nhập, refresh token rotation, logout
│   │   ├── members/                # CRUD danh mục thành viên chung
│   │   ├── weeks/                  # Quản lý tuần, phân bổ thành viên, tính toán báo cáo
│   │   ├── sheets/                 # Đọc/ghi 7 bảng nhập liệu Excel trên web
│   │   ├── imports/                # Đọc file, sinh mẫu (.xlsx/.csv), kiểm tra dữ liệu
│   │   └── exports/                # Xuất báo cáo Excel đa sheet có định dạng
│   └── index.ts                    # Entrypoint máy chủ
├── src/                            # Frontend React TypeScript SPA
│   ├── api/client.ts               # Client gọi API, quản lý token và tự động refresh
│   ├── context/                    # AuthContext (đăng nhập) & WeekContext (chọn tuần, số liệu)
│   ├── components/
│   │   ├── layout/                 # Navbar (tiêu đề, chọn tuần, menu), TabNav (01–06)
│   │   ├── common/                 # Badge, Avatar, Modal
│   │   ├── screens/
│   │   │   ├── Screen1Overview.tsx     # 01 Báo cáo KPI & chất lượng tổng quan (Gauge, 6 thẻ)
│   │   │   ├── Screen2DailyKpi.tsx     # 02 Ma trận KPI theo ngày (T2–T7) & kế hoạch hành động
│   │   │   ├── Screen3Ranking.tsx      # 03 Bảng xếp hạng, Top 3 Podium & kế hoạch training
│   │   │   ├── Screen4QaQuality.tsx    # 04 Chất lượng theo tool QA (cột chồng) & lỗi chung track
│   │   │   ├── Screen5Coaching.tsx     # 05 Coaching từng người & bảng Issue đang mở
│   │   │   └── Screen6Attitude.tsx     # 06 Đánh giá Attitude thang 85–100 & ghi chú lý do
│   │   ├── sheets/
│   │   │   ├── WebExcelGrid.tsx        # Bảng tính Excel trên web cho phép nhập trực tiếp
│   │   │   └── ImportModal.tsx         # Modal import file Excel/CSV kèm kiểm tra lỗi
│   │   ├── members/
│   │   │   └── MembersManager.tsx      # Quản lý danh mục thành viên và phân bổ vào tuần
│   │   └── exports/
│   │       └── ExportModal.tsx         # Xuất báo cáo Excel hoặc mở cửa sổ in PDF
│   ├── styles.css                  # CSS tùy chỉnh, dark palette, @media print
│   └── main.tsx                    # Entrypoint React
└── package.json
```

---

## 3. Khởi chạy & Vận hành

### Bước 1: Khởi tạo database và tài khoản Leader
```bash
npm run db:init
```

### Bước 2: Nạp dữ liệu mẫu từ 6 ảnh thực tế (Vinfast Team T01 tuần 19–25/10/2026)
```bash
npm run db:sample
```

### Bước 3: Chạy môi trường phát triển (Dev)
```bash
npm run dev
```
- Frontend mở tại: `http://localhost:5173`
- Backend API chạy tại: `http://localhost:3001`
- Đăng nhập tài khoản Leader mặc định:
  - **Email**: `lead@anno.local`
  - **Mật khẩu**: `5_XpTS66EggGZ74p1wOBy4Vw` (lấy từ `.env`)

### Kiểm thử và kiểm tra TypeScript
```bash
npm run typecheck    # Kiểm tra kiểu TypeScript toàn bộ dự án
npm test             # Chạy bộ unit test & integration test
npm run build        # Đóng gói sản phẩm cho production
```

---

## 4. Các tính năng nổi bật

1. **Đầy đủ 6 màn hình báo cáo**:
   - `01 Tổng quan`: 6 thẻ KPI, tóm tắt điều hành tự sinh, bảng "Hôm nay", đồng hồ Gauge và 4 điểm nổi bật.
   - `02 KPI theo ngày`: Ma trận T2–T7 với mã màu trực quan, phân tích chất lượng và kế hoạch hành động.
   - `03 Bảng xếp hạng`: Bục vinh danh Top 3 Podium, bảng 7 thành viên, khối training nhóm dưới KPI.
   - `04 Chất lượng QA`: Bảng chi tiết tool QA, biểu đồ cột chồng theo loại cảnh báo, bảng theo dõi track lỗi chung.
   - `05 Coaching & Issue`: Thẻ coaching từng nhân sự, ghi chú số liệu và danh sách Issue chờ xử lý.
   - `06 Attitude`: Thang điểm 85–100 với mốc chuẩn 90 và 95, thẻ ghi chú lý do xếp loại.
2. **Nhập liệu linh hoạt 2 trong 1**:
   - **Bảng Excel trực tiếp trên web**: Chỉnh sửa trực tiếp từng ô (ô sản lượng, ghi chú, cảnh báo, issue), tự động kiểm tra cú pháp và lưu tức thì.
   - **Import Excel (.xlsx) / CSV**: Cho phép tải file mẫu đã điền sẵn tên thành viên của tuần, upload file và xem trước các dòng hợp lệ/lỗi trước khi ghi đè.
3. **Xuất báo cáo đa định dạng**:
   - **Excel (.xlsx)**: Tạo file Excel chuyên nghiệp, mỗi phần được chọn là một sheet riêng có tô màu theo xếp loại và căn chỉnh thẩm mỹ.
   - **PDF**: Định dạng in khổ ngang A4 tối ưu cho họp báo cáo tuần của Leader.
