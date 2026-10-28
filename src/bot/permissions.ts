/**
 * permissions.ts — Role & Permission checks for Boss vs Pilot
 */

import { Message, PermissionsBitField } from 'discord.js';

export function isBoss(message: Message): boolean {
  const authorId = message.author.id;

  // 1. Check BOSS_DISCORD_IDS in .env (e.g. BOSS_DISCORD_IDS=123456,7891011)
  const envBossIds = (process.env.BOSS_DISCORD_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (envBossIds.includes(authorId)) {
    return true;
  }

  // 2. Direct Messages (DM) — if not in env list, not boss
  if (!message.guild || !message.member) {
    return false;
  }

  // 3. Server Owner (Chủ server Discord)
  if (message.guild.ownerId === authorId) {
    return true;
  }

  // 4. Discord Administrator or Manage Guild permission
  if (
    message.member.permissions?.has(PermissionsBitField.Flags.Administrator) ||
    message.member.permissions?.has(PermissionsBitField.Flags.ManageGuild)
  ) {
    return true;
  }

  // 5. Discord Role check (Boss, Admin, Quản Lý, Manager, Chủ, Owner)
  if (message.member.roles?.cache) {
    const bossKeywords = ['boss', 'admin', 'quản lý', 'quan ly', 'manager', 'owner', 'chủ'];
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
