-- Schema KPI annotation (MySQL 8, InnoDB, utf8mb4). Chạy lại nhiều lần an toàn.

-- Tài khoản. Hiện chỉ dùng role 'leader'; qc/annotator dành cho giai đoạn sau.
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(150) NOT NULL,
  email         VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('leader','qc','annotator') NOT NULL DEFAULT 'leader',
  active        TINYINT(1) NOT NULL DEFAULT 1,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  token_hash CHAR(64) PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  expires_at DATETIME NOT NULL,
  INDEX idx_refresh_expiry (expires_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Danh mục thành viên (dùng lại qua nhiều tuần)
CREATE TABLE IF NOT EXISTS members (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(150) NOT NULL,
  role       VARCHAR(100) NOT NULL DEFAULT 'Annotator',
  active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_member_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Một tuần báo cáo (có số thứ tự tuần, ngày bắt đầu và kết thúc)
CREATE TABLE IF NOT EXISTS weeks (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  week_number         INT UNSIGNED NOT NULL DEFAULT 1,
  start_date          DATE NOT NULL,
  end_date            DATE NOT NULL,
  data_as_of          DATE NOT NULL,
  org_name            VARCHAR(100) NOT NULL DEFAULT 'ADAS',
  team_name           VARCHAR(100) NOT NULL DEFAULT 'PerFect T012',
  discipline          VARCHAR(100) NOT NULL DEFAULT '3D LiDAR',
  floor_name          VARCHAR(100) NOT NULL DEFAULT '',
  lead_name           VARCHAR(150) NOT NULL DEFAULT 'Lê Sĩ Thành',
  mentor_name         VARCHAR(150) NOT NULL DEFAULT '',
  target              INT UNSIGNED NOT NULL DEFAULT 1200,
  normal_threshold    INT UNSIGNED NOT NULL DEFAULT 1000,
  excellent_threshold INT UNSIGNED NOT NULL DEFAULT 1200,
  jobs_total          INT UNSIGNED NOT NULL DEFAULT 0,
  jobs_done           INT UNSIGNED NOT NULL DEFAULT 0,
  tool_qa_done        INT UNSIGNED NOT NULL DEFAULT 0,
  data_notes          TEXT NOT NULL,
  summary_override    TEXT NOT NULL,
  updated_by          INT UNSIGNED NULL,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CHECK (jobs_done <= jobs_total),
  CHECK (normal_threshold <= excellent_threshold),
  INDEX idx_week_num_date (week_number, start_date),
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Thành viên tham gia tuần. Xóa dòng này sẽ xóa luôn dữ liệu tuần của người đó.
CREATE TABLE IF NOT EXISTS week_members (
  week_id    INT UNSIGNED NOT NULL,
  member_id  INT UNSIGNED NOT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (week_id, member_id),
  FOREIGN KEY (week_id)   REFERENCES weeks(id)   ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES members(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Sản lượng theo ngày. day_index 0..5 = T2..T7. Không có dòng = chưa nhập.
CREATE TABLE IF NOT EXISTS daily_entries (
  week_id   INT UNSIGNED NOT NULL,
  member_id INT UNSIGNED NOT NULL,
  day_index TINYINT UNSIGNED NOT NULL,
  status    ENUM('work','leave','done') NOT NULL,
  cuboids   INT UNSIGNED NULL,
  estimated TINYINT(1) NOT NULL DEFAULT 0,
  note      VARCHAR(500) NOT NULL DEFAULT '',
  PRIMARY KEY (week_id, member_id, day_index),
  FOREIGN KEY (week_id, member_id) REFERENCES week_members(week_id, member_id) ON DELETE CASCADE,
  CHECK (day_index <= 5),
  CHECK ((status = 'work' AND cuboids IS NOT NULL AND cuboids <= 100000) OR (status <> 'work' AND cuboids IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Số liệu tool QA theo annotator
CREATE TABLE IF NOT EXISTS qa_results (
  week_id         INT UNSIGNED NOT NULL,
  member_id       INT UNSIGNED NOT NULL,
  job_code        VARCHAR(50)  NOT NULL DEFAULT '',
  qc_name         VARCHAR(150) NOT NULL DEFAULT '',
  cuboids         INT UNSIGNED NOT NULL DEFAULT 0,
  warning_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  s_count         INT UNSIGNED NOT NULL DEFAULT 0,
  k_count         INT UNSIGNED NOT NULL DEFAULT 0,
  z_count         INT UNSIGNED NOT NULL DEFAULT 0,
  h_count         INT UNSIGNED NOT NULL DEFAULT 0,
  o_count         INT UNSIGNED NOT NULL DEFAULT 0,
  d_count         INT UNSIGNED NOT NULL DEFAULT 0,
  risk_high       INT UNSIGNED NOT NULL DEFAULT 0,
  risk_mid        INT UNSIGNED NOT NULL DEFAULT 0,
  risk_low        INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (week_id, member_id),
  FOREIGN KEY (week_id, member_id) REFERENCES week_members(week_id, member_id) ON DELETE CASCADE,
  CHECK (warning_percent BETWEEN 0 AND 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Kết quả kiểm tra thủ công bằng tay do QC phát hiện (Bay/Chìm box, Box không ôm sát pointcloud)
CREATE TABLE IF NOT EXISTS manual_qa_results (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  week_id             INT UNSIGNED NOT NULL,
  member_id           INT UNSIGNED NOT NULL,
  job_code            VARCHAR(50)  NOT NULL DEFAULT '',
  qc_name             VARCHAR(150) NOT NULL DEFAULT '',
  cuboids_checked     INT UNSIGNED NOT NULL DEFAULT 0,
  floating_box_count  INT UNSIGNED NOT NULL DEFAULT 0, -- Lỗi bay box / chìm box
  loose_box_count     INT UNSIGNED NOT NULL DEFAULT 0, -- Lỗi box không ôm sát pointcloud
  note                TEXT NOT NULL,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_week_member (week_id, member_id),
  FOREIGN KEY (week_id) REFERENCES weeks(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS attitude_scores (
  week_id   INT UNSIGNED NOT NULL,
  member_id INT UNSIGNED NOT NULL,
  score     TINYINT UNSIGNED NOT NULL DEFAULT 0,
  note      TEXT NOT NULL,
  PRIMARY KEY (week_id, member_id),
  FOREIGN KEY (week_id, member_id) REFERENCES week_members(week_id, member_id) ON DELETE CASCADE,
  CHECK (score <= 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS coachings (
  week_id       INT UNSIGNED NOT NULL,
  member_id     INT UNSIGNED NOT NULL,
  focus_tags    VARCHAR(255) NOT NULL DEFAULT '',
  style         TEXT NOT NULL,
  common_errors TEXT NOT NULL,
  training      TEXT NOT NULL,
  absence_note  TEXT NOT NULL,
  goals         VARCHAR(255) NOT NULL DEFAULT '',
  PRIMARY KEY (week_id, member_id),
  FOREIGN KEY (week_id, member_id) REFERENCES week_members(week_id, member_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Lỗi chung cả nhóm (track rủi ro cao xuất hiện ở nhiều job)
CREATE TABLE IF NOT EXISTS shared_tracks (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  week_id    INT UNSIGNED NOT NULL,
  track_no   VARCHAR(30)  NOT NULL,
  class_name VARCHAR(60)  NOT NULL DEFAULT '',
  job_count  INT UNSIGNED NOT NULL DEFAULT 0,
  in_jobs    VARCHAR(255) NOT NULL DEFAULT '',
  warnings   VARCHAR(40)  NOT NULL DEFAULT '',
  symptom    VARCHAR(1000) NOT NULL DEFAULT '',
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  INDEX idx_tracks_week (week_id, sort_order),
  FOREIGN KEY (week_id) REFERENCES weeks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS issues (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  week_id    INT UNSIGNED NOT NULL,
  code       VARCHAR(30)   NOT NULL DEFAULT '',
  reporter   VARCHAR(100)  NOT NULL DEFAULT '',
  title      VARCHAR(1000) NOT NULL,
  interim    VARCHAR(1000) NOT NULL DEFAULT '',
  next_step  VARCHAR(1000) NOT NULL DEFAULT '',
  status     ENUM('Chờ chốt','Tạm thời','Đã chốt') NOT NULL DEFAULT 'Chờ chốt',
  priority   ENUM('Cao','TB','Thấp') NOT NULL DEFAULT 'Cao',
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  INDEX idx_issues_week (week_id, sort_order),
  FOREIGN KEY (week_id) REFERENCES weeks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS action_items (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  week_id    INT UNSIGNED NOT NULL,
  title      VARCHAR(255) NOT NULL,
  detail     TEXT NOT NULL,
  owner      VARCHAR(100) NOT NULL DEFAULT '',
  priority   ENUM('Cao','TB','Thấp') NOT NULL DEFAULT 'TB',
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  INDEX idx_actions_week (week_id, sort_order),
  FOREIGN KEY (week_id) REFERENCES weeks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Lưu trữ file báo cáo Tool QA gốc
CREATE TABLE IF NOT EXISTS qa_files (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  week_id     INT UNSIGNED NOT NULL,
  member_id   INT UNSIGNED NOT NULL,
  file_name   VARCHAR(255) NOT NULL,
  file_size   INT UNSIGNED NOT NULL DEFAULT 0,
  file_data   LONGBLOB NOT NULL,
  metrics     JSON NULL,
  uploaded_by INT UNSIGNED NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_qa_files_week (week_id, member_id),
  FOREIGN KEY (week_id) REFERENCES weeks(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Nhật ký thao tác
CREATE TABLE IF NOT EXISTS audit_logs (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NULL,
  week_id    INT UNSIGNED NULL,
  action     VARCHAR(60)  NOT NULL,
  detail     VARCHAR(500) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_week (week_id, created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
