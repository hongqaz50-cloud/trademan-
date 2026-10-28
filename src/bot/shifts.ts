/**
 * shifts.ts — Active and completed shift management with disk persistence
 */

import fs from 'fs';
import path from 'path';

export interface ActiveShift {
  userId: string;
  pilotName: string;
  accountName: string;
  note: string;
  startTime: number;
  startHonor: number;
  startAP: number;
  ap50: number;
  ap100: number;
  ap500: number;
  ap1000: number;
  universalMinutes: number;
  trainingMinutes: number;
  healingMinutes: number;
}

export interface CompletedShift {
  id: string;
  userId: string;
  pilotName: string;
  accountName: string;
  note: string;
  startTime: number;
  endTime: number;
  dateStr: string; // e.g. "27/10/2026"
  monthStr: string; // e.g. "10/2026"
  timeRangeStr: string;
  hoursStr: string;
  hoursFloat: number;
  honorGained: number;
  apSpent: number;
  monstersKilled: number;
  efficiencyRate: number;
  efficiencyGrade: string;
  universalSpeed: string;
  trainingSpeed: string;
  healingSpeed: string;
  createdAt: number;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const SHIFTS_FILE = path.join(DATA_DIR, 'shifts.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');

class ShiftManager {
  private activeShifts: Map<string, ActiveShift> = new Map();
  private history: CompletedShift[] = [];

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
    // Load active shifts
    try {
      if (fs.existsSync(SHIFTS_FILE)) {
        const raw = fs.readFileSync(SHIFTS_FILE, 'utf-8');
        const list: ActiveShift[] = JSON.parse(raw);
        for (const s of list) {
          this.activeShifts.set(s.userId, s);
        }
      }
    } catch (err) {
      console.error('Không thể đọc file ca làm shifts.json:', err);
    }

    // Load completed history
    try {
      if (fs.existsSync(HISTORY_FILE)) {
        const raw = fs.readFileSync(HISTORY_FILE, 'utf-8');
        this.history = JSON.parse(raw);
      }
    } catch (err) {
      console.error('Không thể đọc file lịch sử ca làm history.json:', err);
    }
  }

  private saveActiveToDisk() {
    try {
      this.ensureDataDir();
      const list = Array.from(this.activeShifts.values());
      fs.writeFileSync(SHIFTS_FILE, JSON.stringify(list, null, 2), 'utf-8');
    } catch (err) {
      console.error('Không thể lưu file ca làm shifts.json:', err);
    }
  }

  private saveHistoryToDisk() {
    try {
      this.ensureDataDir();
      fs.writeFileSync(HISTORY_FILE, JSON.stringify(this.history, null, 2), 'utf-8');
    } catch (err) {
      console.error('Không thể lưu file lịch sử ca làm history.json:', err);
    }
  }

  // ── Active Shifts ──────────────────────────────────────────────────────────

  public startShift(shift: ActiveShift): void {
    this.activeShifts.set(shift.userId, shift);
    this.saveActiveToDisk();
  }

  public getShift(userId: string): ActiveShift | undefined {
    return this.activeShifts.get(userId);
  }

  public endShift(userId: string): ActiveShift | undefined {
    const shift = this.activeShifts.get(userId);
    if (shift) {
      this.activeShifts.delete(userId);
      this.saveActiveToDisk();
    }
    return shift;
  }

  public cancelShift(userId: string): boolean {
    const existed = this.activeShifts.delete(userId);
    if (existed) {
      this.saveActiveToDisk();
    }
    return existed;
  }

  // ── Completed Shifts (History) ─────────────────────────────────────────────

  public saveCompletedShift(shift: CompletedShift): void {
    this.history.push(shift);
    this.saveHistoryToDisk();
  }

  public getCompletedShifts(filterMonth?: string): CompletedShift[] {
    if (!filterMonth || filterMonth.trim().toLowerCase() === 'all') {
      return [...this.history];
    }
    const target = filterMonth.trim();
    return this.history.filter((s) => {
      // Matches "10/2026", "10", or "10/26"
      if (s.monthStr === target) return true;
      if (s.monthStr.startsWith(target + '/')) return true;
      const [m] = s.monthStr.split('/');
      if (m === target.padStart(2, '0') || m === target) return true;
      return false;
    });
  }

  public getAvailableMonths(): string[] {
    const set = new Set<string>();
    for (const s of this.history) {
      if (s.monthStr) set.add(s.monthStr);
    }
    return Array.from(set).sort().reverse();
  }
}

export const shiftManager = new ShiftManager();
