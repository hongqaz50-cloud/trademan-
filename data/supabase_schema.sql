-- ==============================================================================
-- TRADEMAN ROK PILOT BOT — SUPABASE DATABASE SCHEMA
-- Project URL: https://ssjmdhprgagydhiynqii.supabase.co
-- ==============================================================================

-- 1. BẢNG LƯU TRỮ LỊCH SỬ TẤT CẢ CA LÀM ĐÃ HOÀN THÀNH
CREATE TABLE IF NOT EXISTS completed_shifts (
  id TEXT PRIMARY KEY,
  guild_id TEXT,
  guild_name TEXT,
  user_id TEXT NOT NULL,
  pilot_name TEXT NOT NULL,
  account_name TEXT NOT NULL,
  note TEXT,
  start_time BIGINT NOT NULL,
  end_time BIGINT NOT NULL,
  date_str TEXT NOT NULL,
  month_str TEXT NOT NULL,
  time_range_str TEXT NOT NULL,
  hours_str TEXT NOT NULL,
  hours_float NUMERIC NOT NULL,
  honor_gained INTEGER NOT NULL,
  ap_spent INTEGER NOT NULL,
  monsters_killed NUMERIC NOT NULL,
  efficiency_rate NUMERIC NOT NULL,
  efficiency_grade TEXT NOT NULL,
  universal_speed TEXT,
  training_speed TEXT,
  healing_speed TEXT,
  created_at BIGINT NOT NULL
);

-- TẠO CHỈ MỤC (INDEX) ĐỂ TRUY VẤN CỰC NHANH THEO THÁNG, SERVER, VÀ PILOT
CREATE INDEX IF NOT EXISTS idx_shifts_month ON completed_shifts(month_str);
CREATE INDEX IF NOT EXISTS idx_shifts_guild ON completed_shifts(guild_id);
CREATE INDEX IF NOT EXISTS idx_shifts_user ON completed_shifts(user_id);
CREATE INDEX IF NOT EXISTS idx_shifts_created ON completed_shifts(created_at DESC);

-- 2. BẢNG LƯU TRỮ CÁC CA LÀM ĐANG CHẠY DỞ (KHI VỪA GÕ !start)
CREATE TABLE IF NOT EXISTS active_shifts (
  user_id TEXT PRIMARY KEY,
  guild_id TEXT,
  guild_name TEXT,
  pilot_name TEXT NOT NULL,
  account_name TEXT NOT NULL,
  note TEXT,
  start_time BIGINT NOT NULL,
  start_honor INTEGER NOT NULL,
  start_ap INTEGER NOT NULL,
  ap50 INTEGER DEFAULT 0,
  ap100 INTEGER DEFAULT 0,
  ap500 INTEGER DEFAULT 0,
  ap1000 INTEGER DEFAULT 0,
  universal_minutes INTEGER DEFAULT 0,
  training_minutes INTEGER DEFAULT 0,
  healing_minutes INTEGER DEFAULT 0
);

-- 3. BẢNG PHÂN QUYỀN BOSS & PILOT THEO TỪNG SERVER DISCORD
CREATE TABLE IF NOT EXISTS server_roles (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role_type TEXT NOT NULL, -- 'boss' hoặc 'pilot'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(guild_id, user_id, role_type)
);

CREATE INDEX IF NOT EXISTS idx_roles_lookup ON server_roles(guild_id, user_id);

-- CHÚC MỪNG: BẠN ĐÃ TẠO XONG CƠ SỞ DỮ LIỆU ĐÁM MÂY SUPABASE!
