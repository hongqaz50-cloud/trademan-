/**
 * permissions.ts — Role & Permission checks for Boss vs Pilot with persistent storage
 */

import fs from 'fs';
import path from 'path';
import { Message, PermissionsBitField } from 'discord.js';

interface RoleStorage {
  bosses: string[]; // List of userIds
  pilots: string[]; // List of userIds
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const ROLES_FILE = path.join(DATA_DIR, 'roles.json');

class RoleManager {
  private storage: RoleStorage = {
    bosses: [],
    pilots: [],
  };

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
      if (fs.existsSync(ROLES_FILE)) {
        const raw = fs.readFileSync(ROLES_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        this.storage = {
          bosses: Array.isArray(parsed.bosses) ? parsed.bosses : [],
          pilots: Array.isArray(parsed.pilots) ? parsed.pilots : [],
        };
      }
    } catch (err) {
      console.error('Không thể đọc file roles.json:', err);
    }
  }

  private saveToDisk() {
    try {
      this.ensureDataDir();
      fs.writeFileSync(ROLES_FILE, JSON.stringify(this.storage, null, 2), 'utf-8');
    } catch (err) {
      console.error('Không thể lưu file roles.json:', err);
    }
  }

  public addBoss(userId: string): boolean {
    if (!this.storage.bosses.includes(userId)) {
      this.storage.bosses.push(userId);
      // Remove from pilots if present
      this.storage.pilots = this.storage.pilots.filter((id) => id !== userId);
      this.saveToDisk();
      return true;
    }
    return false;
  }

  public removeBoss(userId: string): boolean {
    const prevLen = this.storage.bosses.length;
    this.storage.bosses = this.storage.bosses.filter((id) => id !== userId);
    if (this.storage.bosses.length !== prevLen) {
      this.saveToDisk();
      return true;
    }
    return false;
  }

  public addPilot(userId: string): boolean {
    if (!this.storage.pilots.includes(userId)) {
      this.storage.pilots.push(userId);
      this.saveToDisk();
      return true;
    }
    return false;
  }

  public removePilot(userId: string): boolean {
    const prevLen = this.storage.pilots.length;
    this.storage.pilots = this.storage.pilots.filter((id) => id !== userId);
    if (this.storage.pilots.length !== prevLen) {
      this.saveToDisk();
      return true;
    }
    return false;
  }

  public getBossList(): string[] {
    return [...this.storage.bosses];
  }

  public getPilotList(): string[] {
    return [...this.storage.pilots];
  }

  public isStoredBoss(userId: string): boolean {
    return this.storage.bosses.includes(userId);
  }

  public isStoredPilot(userId: string): boolean {
    return this.storage.pilots.includes(userId);
  }
}

export const roleManager = new RoleManager();

export function isBoss(message: Message): boolean {
  const authorId = message.author.id;

  // 1. Check stored bosses in data/roles.json
  if (roleManager.isStoredBoss(authorId)) {
    return true;
  }

  // 2. Check BOSS_DISCORD_IDS in .env (e.g. BOSS_DISCORD_IDS=123456,7891011)
  const envBossIds = (process.env.BOSS_DISCORD_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (envBossIds.includes(authorId)) {
    return true;
  }

  // 3. BOOTSTRAP: If NO boss has been registered yet, allow the initial setup!
  if (roleManager.getBossList().length === 0 && envBossIds.length === 0) {
    return true;
  }

  // 4. Direct Messages (DM) — if not in stored or env list, not boss
  if (!message.guild || !message.member) {
    return false;
  }

  // 5. Server Owner (Chủ server Discord)
  if (message.guild.ownerId === authorId) {
    return true;
  }

  // 6. Discord Administrator or Management permissions
  if (
    message.member.permissions?.has(PermissionsBitField.Flags.Administrator) ||
    message.member.permissions?.has(PermissionsBitField.Flags.ManageGuild) ||
    message.member.permissions?.has(PermissionsBitField.Flags.ManageRoles) ||
    message.member.permissions?.has(PermissionsBitField.Flags.ManageChannels)
  ) {
    return true;
  }

  // 7. Discord Role check (Boss, Admin, Quản Lý, Manager, Chủ, Owner, Leader, Mod)
  if (message.member.roles?.cache) {
    const bossKeywords = ['boss', 'admin', 'quản lý', 'quan ly', 'manager', 'owner', 'chủ', 'leader', 'mod'];
    const hasBossRole = message.member.roles.cache.some((role) => {
      const lower = role.name.toLowerCase();
      return bossKeywords.some((kw) => lower.includes(kw));
    });
    if (hasBossRole) {
      return true;
    }
  }

  return false;
}
