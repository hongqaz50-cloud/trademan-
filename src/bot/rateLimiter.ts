/**
 * rateLimiter.ts — Daily rate limiter for pilot salary queries
 * Limits each pilot to 2 checks per day (resets daily at 00:00 UTC+7)
 */

import fs from 'fs';
import path from 'path';
import { formatVNDate } from './timeUtils';

interface UserDailyRecord {
  date: string; // e.g. "28/10/2026"
  count: number;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const LIMITS_FILE = path.join(DATA_DIR, 'salary_limits.json');
const MAX_CHECKS_PER_DAY = 2;

class DailyRateLimiter {
  private records: Map<string, UserDailyRecord> = new Map();

  constructor() {
    this.ensureDataDir();
    this.loadFromDisk();
  }

  private ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(LIMITS_FILE)) {
        const raw = fs.readFileSync(LIMITS_FILE, 'utf-8');
        const parsed: Record<string, UserDailyRecord> = JSON.parse(raw);
        for (const [userId, record] of Object.entries(parsed)) {
          this.records.set(userId, record);
        }
      }
    } catch (err) {
      console.error('Không thể đọc file salary_limits.json:', err);
    }
  }

  private saveToDisk() {
    try {
      this.ensureDataDir();
      const obj: Record<string, UserDailyRecord> = {};
      for (const [userId, record] of this.records.entries()) {
        obj[userId] = record;
      }
      fs.writeFileSync(LIMITS_FILE, JSON.stringify(obj, null, 2), 'utf-8');
    } catch (err) {
      console.error('Không thể lưu file salary_limits.json:', err);
    }
  }

  private getTodayStr(): string {
    return formatVNDate(Date.now());
  }

  public getSalaryCheckCount(userId: string): number {
    const today = this.getTodayStr();
    const record = this.records.get(userId);
    if (!record || record.date !== today) {
      return 0;
    }
    return record.count;
  }

  public canCheckSalary(userId: string): {
    allowed: boolean;
    count: number;
    remaining: number;
    max: number;
  } {
    const count = this.getSalaryCheckCount(userId);
    const allowed = count < MAX_CHECKS_PER_DAY;
    const remaining = Math.max(0, MAX_CHECKS_PER_DAY - count);
    return {
      allowed,
      count,
      remaining,
      max: MAX_CHECKS_PER_DAY,
    };
  }

  public incrementSalaryCheck(userId: string): number {
    const today = this.getTodayStr();
    let record = this.records.get(userId);
    if (!record || record.date !== today) {
      record = { date: today, count: 1 };
    } else {
      record.count += 1;
    }
    this.records.set(userId, record);
    this.saveToDisk();
    return record.count;
  }
}

export const salaryRateLimiter = new DailyRateLimiter();
