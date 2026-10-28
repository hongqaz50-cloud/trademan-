/**
 * index.ts — Discord Bot Runner for AP Efficiency & Pilot Shift Reports
 */

import http from 'http';
import {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  AttachmentBuilder,
  Message,
} from 'discord.js';
import { DISCORD_BOT_TOKEN, GEMINI_API_KEY, updateGeminiApiKey, validateConfig } from './config';
import { scanBatchScreenshots } from './vision';
import { shiftManager, type ActiveShift, type CompletedShift } from './shifts';
import { formatVNTime, formatROKGameTime, formatVNDate, formatVNMonth } from './timeUtils';
import { computeShiftReport, buildReportEmbed } from './report';
import { generateMonthlyExcelReport } from './excelExport';
import { isBoss, roleManager } from './permissions';
import { salaryRateLimiter } from './rateLimiter';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message],
});

// ── Startup & Ready Event ────────────────────────────────────────────────────

client.once('clientReady', (c) => {
  console.log(`================================================`);
  console.log(`🤖 Discord Bot đã đăng nhập: ${c.user.tag}`);
  console.log(`⚡ Sẵn sàng nhận lệnh: !huongdan, !start, !end, !salary, !excel, !status, !cancel, !setboss, !setpilot, !roles`);
  console.log(`================================================`);
});

// ── Command Handlers ─────────────────────────────────────────────────────────

client.on('messageCreate', async (message: Message) => {
  if (message.author.bot) return;

  const content = message.content.trim();
  const lower = content.toLowerCase();

  // Command: !help, !huongdan, !guide, !lenh
  if (
    lower === '!help' ||
    lower === '!huongdan' ||
    lower === '!guide' ||
    lower === '!lenh'
  ) {
    await handleHelp(message);
    return;
  }

  // Command: !setboss @user or !addboss @user
  if (lower.startsWith('!setboss') || lower.startsWith('!addboss')) {
    await handleSetBoss(message);
    return;
  }

  // Command: !removeboss @user or !delboss @user
  if (lower.startsWith('!removeboss') || lower.startsWith('!delboss')) {
    await handleRemoveBoss(message);
    return;
  }

  // Command: !setpilot @user or !addpilot @user
  if (lower.startsWith('!setpilot') || lower.startsWith('!addpilot')) {
    await handleSetPilot(message);
    return;
  }

  // Command: !removepilot @user or !delpilot @user
  if (lower.startsWith('!removepilot') || lower.startsWith('!delpilot')) {
    await handleRemovePilot(message);
    return;
  }

  // Command: !roles or !listroles
  if (lower === '!roles' || lower === '!listroles' || lower === '!role') {
    await handleListRoles(message);
    return;
  }

  // Command: !excel [month] or !export [month]
  if (lower.startsWith('!excel') || lower.startsWith('!export')) {
    await handleExcel(message);
    return;
  }

  // Command: !luong [month] or !salary [month]
  if (lower.startsWith('!luong') || lower.startsWith('!salary')) {
    await handleLuong(message);
    return;
  }

  // Command: !setkey <gemini_api_key>
  if (lower.startsWith('!setkey')) {
    const rawKey = content.slice('!setkey'.length).trim();
    if (!rawKey) {
      await message.reply('⚠️ Cú pháp: `!setkey <gemini_api_key>` (Lấy key miễn phí tại https://aistudio.google.com/app/apikey)');
      return;
    }
    updateGeminiApiKey(rawKey);
    await message.reply('✅ Đã lưu Gemini API Key thành công! Bây giờ bạn có thể dùng `!start` và `!end` kèm 3 ảnh để quét tự động.');
    return;
  }

  // Command: !status
  if (lower === '!status') {
    await handleStatus(message);
    return;
  }

  // Command: !cancel
  if (lower === '!cancel') {
    await handleCancel(message);
    return;
  }

  // Command: !start [note]
  if (lower.startsWith('!start')) {
    await handleStart(message);
    return;
  }

  // Command: !end [note]
  if (lower.startsWith('!end')) {
    await handleEnd(message);
    return;
  }
});

// ── 1. Handle !start ─────────────────────────────────────────────────────────

async function handleStart(message: Message) {
  if (!GEMINI_API_KEY) {
    await message.reply(
      '⚠️ **Chưa có Gemini API Key!**\n' +
      'Vui lòng gõ lệnh: `!setkey <key_của_bạn>` để kích hoạt quét ảnh AI (Lấy key miễn phí tại: https://aistudio.google.com/app/apikey)'
    );
    return;
  }

  const images = getAttachedImageUrls(message);

  if (images.length === 0) {
    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('⚠️ Thiếu Ảnh Đính Kèm')
          .setColor(0xf59e0b)
          .setDescription(
            `Vui lòng đính kèm **3 ảnh chụp màn hình** cùng với lệnh \`!start [ghi chú]\`:\n\n` +
            `1. 🎖️ **Bảng Danh Dự** (Honor Board)\n` +
            `2. 🧪 **Kho Bình AP** (Action Points in bag)\n` +
            `3. ⚡ **Kho Tăng Tốc** (Speedups in bag)\n\n` +
            `*Ví dụ:* Gửi 3 ảnh với nội dung \`!start 5 marches\` (hoặc chỉ cần gõ \`!start\`).`
          ),
      ],
    });
    return;
  }

  const rawNote = message.content.slice('!start'.length).trim();
  const note = rawNote || '5 marches';
  const pilotName = message.member?.displayName || message.author.globalName || message.author.username;

  const statusMsg = await message.reply('⏳ **Đang phân tích 3 ảnh ban đầu qua Gemini AI...**');

  try {
    const scan = await scanBatchScreenshots(images);

    const now = Date.now();
    const shift: ActiveShift = {
      guildId: message.guild?.id,
      guildName: message.guild?.name,
      userId: message.author.id,
      pilotName,
      accountName: scan.accountName,
      note,
      startTime: now,
      startHonor: scan.honorValue,
      startAP: scan.totalAP,
      ap50: scan.ap50,
      ap100: scan.ap100,
      ap500: scan.ap500,
      ap1000: scan.ap1000,
      universalMinutes: scan.universalMinutes,
      trainingMinutes: scan.trainingMinutes,
      healingMinutes: scan.healingMinutes,
    };

    shiftManager.startShift(shift);

    const startVN = formatVNTime(now);
    const startROK = formatROKGameTime(now);

    const uDays = Math.floor(scan.universalMinutes / 1440);
    const uHours = Math.floor((scan.universalMinutes % 1440) / 60);

    const embed = new EmbedBuilder()
      .setTitle('🟢 BẮT ĐẦU CA LÀM VIỆC (SHIFT STARTED)')
      .setColor(0x10b981)
      .addFields(
        { name: '👤 Pilot', value: `\`${pilotName}\``, inline: true },
        { name: '🏰 Tài Khoản (Account)', value: `\`${scan.accountName}\``, inline: true },
        { name: '📝 Ghi Chú', value: `\`${note}\``, inline: true },
        { name: '⏰ Bắt Đầu (Giờ VN UTC+7)', value: `\`${startVN}\``, inline: true },
        { name: '🎮 Bắt Đầu (Giờ Game ROK)', value: `\`${startROK}\``, inline: true },
        { name: '🎖️ Điểm Danh Dự Đầu Ca', value: `**${scan.honorValue.toLocaleString('en-US')}**`, inline: true },
        { name: '🧪 Tổng Kho AP Đầu Ca', value: `**${scan.totalAP.toLocaleString('en-US')}** AP`, inline: true },
        {
          name: '⚡ Tăng Tốc Đầu Ca',
          value: `Chung: \`${uDays}d ${uHours}h\` · Luyện: \`${Math.floor(scan.trainingMinutes / 1440)}d\` · Chữa: \`${Math.floor(scan.healingMinutes / 1440)}d\``,
          inline: true,
        }
      )
      .setFooter({ text: 'Khi kết thúc ca, hãy gửi "!end [ghi chú]" kèm 3 ảnh kết thúc!' })
      .setTimestamp();

    await statusMsg.edit({
      content: '✅ **Ca làm việc đã được bắt đầu thành công!**',
      embeds: [embed],
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Lỗi khi xử lý !start:', err);
    await statusMsg.edit(`❌ **Lỗi khi phân tích ảnh:** ${msg}`);
  }
}

// ── 2. Handle !end ───────────────────────────────────────────────────────────

async function handleEnd(message: Message) {
  if (!GEMINI_API_KEY) {
    await message.reply(
      '⚠️ **Chưa có Gemini API Key!**\nVui lòng gõ lệnh: `!setkey <key_của_bạn>` để kích hoạt quét ảnh AI.'
    );
    return;
  }

  const shift = shiftManager.getShift(message.author.id);

  if (!shift) {
    await message.reply(
      '⚠️ **Bạn chưa bắt đầu ca làm nào!**\n' +
      'Vui lòng gửi lệnh `!start [ghi chú]` kèm 3 ảnh ban đầu trước khi kết thúc ca.'
    );
    return;
  }

  const images = getAttachedImageUrls(message);

  if (images.length === 0) {
    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('⚠️ Thiếu Ảnh Đính Kèm')
          .setColor(0xf59e0b)
          .setDescription(
            `Vui lòng đính kèm **3 ảnh chụp màn hình kết thúc** cùng với lệnh \`!end\`:\n\n` +
            `1. 🎖️ **Bảng Danh Dự** (Honor Board)\n` +
            `2. 🧪 **Kho Bình AP** (Action Points in bag)\n` +
            `3. ⚡ **Kho Tăng Tốc** (Speedups in bag)\n\n` +
            `*Ví dụ:* Gửi 3 ảnh với nội dung \`!end\`.`
          ),
      ],
    });
    return;
  }

  const rawNote = message.content.slice('!end'.length).trim();
  const endNote = rawNote || shift.note || '5 marches';

  const statusMsg = await message.reply('⏳ **Đang phân tích 3 ảnh kết thúc và tổng hợp báo cáo...**');

  try {
    const scanEnd = await scanBatchScreenshots(images);

    const endTime = Date.now();

    // Remove active shift from tracking
    shiftManager.endShift(message.author.id);

    // Compute complete shift report
    const reportData = computeShiftReport(shift, scanEnd, endTime, endNote);

    const dateStr = formatVNDate(endTime);
    const monthStr = formatVNMonth(endTime);

    // Save to completed shifts history
    const completedShift: CompletedShift = {
      id: `shift_${endTime}_${message.author.id}`,
      guildId: message.guild?.id || shift.guildId,
      guildName: message.guild?.name || shift.guildName,
      userId: message.author.id,
      pilotName: reportData.pilotName,
      accountName: reportData.accountName,
      note: reportData.note,
      startTime: shift.startTime,
      endTime,
      dateStr,
      monthStr,
      timeRangeStr: reportData.timeStr,
      hoursStr: reportData.hoursStr,
      hoursFloat: reportData.hoursFloat,
      honorGained: reportData.honorGained,
      apSpent: reportData.apSpent,
      monstersKilled: reportData.monstersKilled,
      efficiencyRate: reportData.efficiencyRate,
      efficiencyGrade: reportData.efficiencyTier.grade,
      universalSpeed: reportData.universalSpeed,
      trainingSpeed: reportData.trainingSpeed,
      healingSpeed: reportData.healingSpeed,
      createdAt: endTime,
    };
    shiftManager.saveCompletedShift(completedShift);

    const embed = buildReportEmbed(reportData);

    // Reply with Embed
    await statusMsg.edit({
      content: `✅ **Ca làm đã hoàn tất! Đã tự động lưu vào sổ chấm công Tháng ${monthStr}:**`,
      embeds: [embed],
    });

    // Send pure text block for easy mobile copy
    await message.reply({
      content: `\`\`\`\n${reportData.reportText}\n\`\`\`\n💼 *Dữ liệu ca đã được lưu tự động. Bạn có thể dùng lệnh \`!salary\` để tra cứu tổng kết ca của bản thân.*`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Lỗi khi xử lý !end:', err);
    await statusMsg.edit(`❌ **Lỗi khi tính toán báo cáo:** ${msg}`);
  }
}

// ── 3. Handle !excel ─────────────────────────────────────────────────────────

async function handleExcel(message: Message) {
  // Access Control: Boss / Admin only!
  if (!isBoss(message)) {
    const embed = new EmbedBuilder()
      .setTitle('⛔ QUYỀN TRUY CẬP BỊ TỪ CHỐI')
      .setColor(0xef4444)
      .setDescription(
        `Xin chào **${message.member?.displayName || message.author.username}**,\n\n` +
        `Lệnh \`!excel\` chỉ dành riêng cho **Boss / Quản Lý** để bảo mật toàn bộ dữ liệu lương và ca làm của cả đội.\n\n` +
        `👉 Để xem số ca và số giờ làm của **chính bạn**, hãy sử dụng lệnh:\n` +
        `**\`!salary\`** hoặc **\`!luong\`** *(Tối đa 2 lần / ngày)*`
      )
      .setFooter({ text: 'Bảo mật thông tin nhân sự · AP Efficiency Bot' });
    await message.reply({ embeds: [embed] });
    return;
  }

  const content = message.content.trim();
  const rawArg = content.replace(/^!(?:excel|export)/i, '').trim();

  const now = Date.now();
  const currentMonthStr = formatVNMonth(now);
  const targetMonth = rawArg || currentMonthStr;

  const statusMsg = await message.reply('⏳ **Đang tổng hợp dữ liệu ca làm và xuất file Excel...**');

  try {
    const guildId = message.guild?.id;
    const shifts = shiftManager.getCompletedShifts(targetMonth, guildId);

    if (shifts.length === 0) {
      const available = shiftManager.getAvailableMonths();
      const availableText = available.length > 0 ? available.join(', ') : 'Chưa có tháng nào';
      await statusMsg.edit(
        `⚠️ **Không tìm thấy ca làm nào cho kỳ: \`${targetMonth}\`**\n` +
        `Các tháng hiện có dữ liệu: \`${availableText}\`\n\n` +
        `*Gợi ý lệnh:* \`!excel 10/2026\` hoặc \`!excel all\``
      );
      return;
    }

    const excel = await generateMonthlyExcelReport(shifts, {
      monthFilter: targetMonth === 'all' ? 'Tong_Hop' : targetMonth,
      now,
    });

    const attachment = new AttachmentBuilder(excel.buffer, { name: excel.fileName });

    const uniquePilots = new Set(shifts.map((s) => s.pilotName)).size;
    const totalHonor = shifts.reduce((acc, s) => acc + s.honorGained, 0);
    const totalAP = shifts.reduce((acc, s) => acc + s.apSpent, 0);

    const embed = new EmbedBuilder()
      .setTitle('📊 BÁO CÁO CA LÀM & TÍNH TIỀN LƯƠNG NHÂN VIÊN (.XLSX)')
      .setColor(0x10b981)
      .setDescription(
        `Đã xuất dữ liệu ca làm **${targetMonth === 'all' ? 'Tất Cả Ca Làm' : `Tháng ${targetMonth}`}** thành file Excel chuyên nghiệp.\n\n` +
        `📁 **File đính kèm gồm 2 Sheet:**\n` +
        `• **Sheet 1 (Chi Tiết Ca Làm):** Toàn bộ nhật ký ca làm, AP, danh dự, tăng tốc.\n` +
        `• **Sheet 2 (Bảng Tính Lương Pilot):** Tổng hợp giờ làm theo nhân viên và có công thức tự động tính tiền!`
      )
      .addFields(
        { name: '📅 Kỳ Tính', value: `\`${targetMonth}\``, inline: true },
        { name: '👥 Nhân Viên (Pilots)', value: `**${uniquePilots}** người`, inline: true },
        { name: '📋 Tổng Số Ca', value: `**${excel.totalShifts}** ca`, inline: true },
        { name: '⏳ Tổng Giờ Làm', value: `**${excel.totalHours}** giờ`, inline: true },
        { name: '🎖️ Tổng Danh Dự', value: `**${totalHonor.toLocaleString('en-US')}**`, inline: true },
        { name: '🧪 Tổng AP Tiêu Hao', value: `**${totalAP.toLocaleString('en-US')}** AP`, inline: true },
        {
          name: '💰 Hướng Dẫn Tính Tiền Lương',
          value:
            'Tải file Excel đính kèm bên dưới về máy ➜ Mở **Sheet 2 (Bảng Tính Lương Pilot)** ➜ Điền số tiền vào cột **Đơn Giá / Giờ (màu vàng)**, Excel sẽ tự động tính thành tiền lương cho từng nhân viên!',
          inline: false,
        }
      )
      .setFooter({ text: 'AP Efficiency Bot · Dành riêng cho Boss / Quản lý' })
      .setTimestamp();

    await statusMsg.edit({
      content: '✅ **Xuất file Excel thành công!**',
      embeds: [embed],
      files: [attachment],
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Lỗi khi xuất file Excel:', err);
    await statusMsg.edit(`❌ **Lỗi khi tạo file Excel:** ${msg}`);
  }
}

// ── 4. Handle !luong / !salary ───────────────────────────────────────────────

async function handleLuong(message: Message) {
  const content = message.content.trim();
  const rawArg = content.replace(/^!(?:luong|salary)/i, '').trim();
  const now = Date.now();
  const currentMonth = formatVNMonth(now);

  const isUserBoss = isBoss(message);

  // Parse arguments: could be a month (e.g. "10/2026", "10"), "all", or a pilot name / mention
  const tokens = rawArg.split(/\s+/).filter(Boolean);
  let targetMonth = currentMonth;
  let targetUserOrName = '';
  let showAll = false;

  for (const token of tokens) {
    if (token.toLowerCase() === 'all') {
      showAll = true;
    } else if (/^\d{1,2}(\/\d{4})?$/.test(token)) {
      targetMonth = token;
    } else {
      targetUserOrName = token;
    }
  }

  // Check if someone was mentioned: message.mentions.users.first()
  const mentionedUser = message.mentions.users.first();
  if (mentionedUser) {
    targetUserOrName = mentionedUser.id;
  }

  const guildId = message.guild?.id;

  // ── CASE 1: BOSS VIEWING ALL PILOTS ──
  if (isUserBoss && (showAll || (!targetUserOrName && !tokens.some((t) => t.toLowerCase() === 'me')))) {
    const shifts = shiftManager.getCompletedShifts(targetMonth, guildId);
    if (shifts.length === 0) {
      const available = shiftManager.getAvailableMonths();
      const availableText = available.length > 0 ? available.join(', ') : 'Chưa có tháng nào';
      await message.reply(
        `ℹ️ Chưa có ca làm nào trong kỳ **${targetMonth}**.\n` +
        `Các tháng hiện có dữ liệu: \`${availableText}\``
      );
      return;
    }

    const pilotMap = new Map<
      string,
      { shifts: number; hours: number; ap: number; honor: number }
    >();

    for (const s of shifts) {
      if (!pilotMap.has(s.pilotName)) {
        pilotMap.set(s.pilotName, { shifts: 0, hours: 0, ap: 0, honor: 0 });
      }
      const item = pilotMap.get(s.pilotName)!;
      item.shifts++;
      item.hours += s.hoursFloat;
      item.ap += s.apSpent;
      item.honor += s.honorGained;
    }

    const lines = Array.from(pilotMap.entries()).map(([pilot, data], idx) => {
      const hoursFormatted = Math.round(data.hours * 10) / 10;
      return `${idx + 1}. **${pilot}**: \`${hoursFormatted}h\` làm việc (${data.shifts} ca) · AP: \`${data.ap.toLocaleString('en-US')}\` · Danh dự: \`${data.honor.toLocaleString('en-US')}\``;
    });

    const totalHours = Math.round(shifts.reduce((acc, s) => acc + s.hoursFloat, 0) * 10) / 10;

    const embed = new EmbedBuilder()
      .setTitle(`👑 TỔNG HỢP CÔNG TOÀN ĐỘI - THÁNG ${targetMonth}`)
      .setColor(0x06b6d4)
      .setDescription(lines.join('\n\n'))
      .addFields(
        { name: '👥 Nhân Viên', value: `${pilotMap.size} người`, inline: true },
        { name: '📋 Tổng Ca Làm', value: `${shifts.length} ca`, inline: true },
        { name: '⏳ Tổng Giờ Toàn Đội', value: `${totalHours} giờ`, inline: true }
      )
      .setFooter({ text: 'Boss Menu · Gõ !excel để tải file Excel có công thức tính lương tự động' })
      .setTimestamp();

    await message.reply({ embeds: [embed] });
    return;
  }

  // ── CASE 2: BOSS CHECKING A SPECIFIC PILOT ──
  if (isUserBoss && targetUserOrName) {
    const pilotKeywords = [targetUserOrName];
    if (mentionedUser) {
      pilotKeywords.push(mentionedUser.username, mentionedUser.displayName || '');
    }
    const shifts = shiftManager.getPilotShifts(
      mentionedUser ? mentionedUser.id : targetUserOrName,
      pilotKeywords,
      targetMonth,
      guildId
    );

    if (shifts.length === 0) {
      await message.reply(
        `ℹ️ Không tìm thấy ca làm nào của nhân viên \`${targetUserOrName}\` trong kỳ **${targetMonth}**.`
      );
      return;
    }

    const pilotDisplayName = shifts[0].pilotName || targetUserOrName;
    const totalHours = Math.round(shifts.reduce((acc, s) => acc + s.hoursFloat, 0) * 10) / 10;
    const totalHonor = shifts.reduce((acc, s) => acc + s.honorGained, 0);
    const totalAP = shifts.reduce((acc, s) => acc + s.apSpent, 0);
    const totalMonsters = shifts.reduce((acc, s) => acc + s.monstersKilled, 0);

    const recentShiftsText = shifts
      .slice(-5)
      .reverse()
      .map(
        (s, i) =>
          `${i + 1}. **${s.dateStr}** - Acc: \`${s.accountName}\` | \`${s.hoursStr}h\` | Hạng **${s.efficiencyGrade}** (${s.efficiencyRate}%) | Danh dự: +${s.honorGained.toLocaleString('en-US')}`
      )
      .join('\n');

    const embed = new EmbedBuilder()
      .setTitle(`💼 BẢNG CÔNG NHÂN VIÊN: ${pilotDisplayName}`)
      .setColor(0x3b82f6)
      .setDescription(`Dữ liệu ca làm việc trong **Tháng ${targetMonth}** (Chế độ xem Boss):`)
      .addFields(
        { name: '📋 Tổng Ca Làm', value: `**${shifts.length}** ca`, inline: true },
        { name: '⏳ Tổng Giờ Làm', value: `**${totalHours}** giờ`, inline: true },
        { name: '🎖️ Tổng Danh Dự', value: `**${totalHonor.toLocaleString('en-US')}**`, inline: true },
        { name: '🧪 Tổng AP Tiêu Hao', value: `**${totalAP.toLocaleString('en-US')}** AP`, inline: true },
        { name: '👾 Quái Diệt', value: `**${totalMonsters.toLocaleString('en-US')}**`, inline: true },
        { name: '📅 Kỳ Tính', value: `\`${targetMonth}\``, inline: true },
        { name: '📝 5 Ca Gần Nhất', value: recentShiftsText || 'Chưa có chi tiết ca.', inline: false }
      )
      .setFooter({ text: 'Boss Viewer · Không giới hạn lượt tra cứu' })
      .setTimestamp();

    await message.reply({ embeds: [embed] });
    return;
  }

  // ── CASE 3: NORMAL PILOT (NGƯỜI LÀM) — CHECKING THEMSELVES ONLY ──
  // Check daily rate limit (2 checks per day)
  const rateLimit = salaryRateLimiter.canCheckSalary(message.author.id);
  if (!rateLimit.allowed) {
    const embed = new EmbedBuilder()
      .setTitle('⚠️ ĐÃ HẾT LƯỢT KIỂM TRA LƯƠNG HÔM NAY')
      .setColor(0xf59e0b)
      .setDescription(
        `Xin chào **${message.member?.displayName || message.author.username}**,\n\n` +
        `Bạn đã sử dụng hết **2 / 2** lượt kiểm tra công hôm nay.\n` +
        `Quy định: Mỗi Pilot được tra cứu tối đa **2 lần / ngày** để đảm bảo bảo mật hệ thống.\n\n` +
        `⏰ Lượt tra cứu sẽ được làm mới vào lúc **00:00 ngày mai (giờ VN)**.\n` +
        `*Nếu có thắc mắc khẩn cấp về công hoặc lương, vui lòng liên hệ Boss / Quản Lý.*`
      )
      .setFooter({ text: 'Giới hạn 2 lần/ngày · Bảo mật dữ liệu Pilot' });
    await message.reply({ embeds: [embed] });
    return;
  }

  // Get this pilot's shifts for target month
  const pilotKeywords = [
    message.member?.displayName || '',
    message.author.globalName || '',
    message.author.username,
  ].filter(Boolean);

  const userShifts = shiftManager.getPilotShifts(message.author.id, pilotKeywords, targetMonth, guildId);

  if (userShifts.length === 0) {
    await message.reply(
      `ℹ️ Bạn chưa có ca làm nào được ghi nhận trong **Tháng ${targetMonth}**.\n\n` +
      `*(Nếu bạn vừa làm xong ca, hãy đảm bảo đã gửi lệnh \`!end\` kèm 3 ảnh để bot lưu ca nhé!)*`
    );
    return;
  }

  // Increment usage count for today
  const currentCount = salaryRateLimiter.incrementSalaryCheck(message.author.id);
  const remainingToday = Math.max(0, 2 - currentCount);

  const pilotName = userShifts[0].pilotName || message.member?.displayName || message.author.username;
  const totalHours = Math.round(userShifts.reduce((acc, s) => acc + s.hoursFloat, 0) * 10) / 10;
  const totalHonor = userShifts.reduce((acc, s) => acc + s.honorGained, 0);
  const totalAP = userShifts.reduce((acc, s) => acc + s.apSpent, 0);
  const totalMonsters = userShifts.reduce((acc, s) => acc + s.monstersKilled, 0);

  const recentShiftsText = userShifts
    .slice(-5)
    .reverse()
    .map(
      (s, i) =>
        `${i + 1}. **${s.dateStr}** - Acc: \`${s.accountName}\` | \`${s.hoursStr}h\` | Hạng **${s.efficiencyGrade}** (${s.efficiencyRate}%) | Danh dự: +${s.honorGained.toLocaleString('en-US')}`
    )
    .join('\n');

  const embed = new EmbedBuilder()
    .setTitle(`💼 BẢNG CÔNG CÁ NHÂN - THÁNG ${targetMonth}`)
    .setColor(0x10b981)
    .setDescription(
      `Thông tin công và hiệu suất làm việc của Pilot: **${pilotName}**\n` +
      `🔒 *Dữ liệu này chỉ hiển thị riêng cho bạn.*`
    )
    .addFields(
      { name: '📋 Tổng Ca Làm', value: `**${userShifts.length}** ca`, inline: true },
      { name: '⏳ Tổng Giờ Làm', value: `**${totalHours}** giờ`, inline: true },
      { name: '🎖️ Tổng Danh Dự', value: `**${totalHonor.toLocaleString('en-US')}**`, inline: true },
      { name: '🧪 Tổng AP Tiêu Hao', value: `**${totalAP.toLocaleString('en-US')}** AP`, inline: true },
      { name: '👾 Tổng Quái Diệt', value: `**${totalMonsters.toLocaleString('en-US')}**`, inline: true },
      { name: '📊 Lượt Tra Cứu Hôm Nay', value: `**${currentCount} / 2** lần *(Còn ${remainingToday} lần)*`, inline: true },
      { name: '📝 5 Ca Làm Gần Nhất', value: recentShiftsText || 'Chưa có chi tiết ca.', inline: false }
    )
    .setFooter({ text: 'Bảo mật cá nhân · Tối đa 2 lần tra cứu/ngày · Reset lúc 00:00' })
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}

// ── 5. Handle !status ────────────────────────────────────────────────────────

async function handleStatus(message: Message) {
  const shift = shiftManager.getShift(message.author.id);

  if (!shift) {
    await message.reply('ℹ️ Hiện tại bạn không có ca làm nào đang chạy. Gửi `!start` kèm 3 ảnh để bắt đầu!');
    return;
  }

  const now = Date.now();
  const elapsedMs = Math.max(0, now - shift.startTime);
  const elapsedMins = Math.round(elapsedMs / 60000);
  const h = Math.floor(elapsedMins / 60);
  const m = elapsedMins % 60;

  const startVN = formatVNTime(shift.startTime);
  const startROK = formatROKGameTime(shift.startTime);

  const embed = new EmbedBuilder()
    .setTitle('⏱️ CA LÀM HIỆN TẠI ĐANG CHẠY')
    .setColor(0x06b6d4)
    .addFields(
      { name: '👤 Pilot', value: `\`${shift.pilotName}\``, inline: true },
      { name: '🏰 Account', value: `\`${shift.accountName}\``, inline: true },
      { name: '📝 Note', value: `\`${shift.note}\``, inline: true },
      { name: '⏰ Bắt Đầu (VN UTC+7)', value: `\`${startVN}\``, inline: true },
      { name: '🎮 Bắt Đầu (ROK Game)', value: `\`${startROK}\``, inline: true },
      { name: '⏳ Đã Làm Được', value: `\`${h} giờ ${m} phút\``, inline: true },
      { name: '🎖️ Danh Dự Đầu', value: `\`${shift.startHonor.toLocaleString('en-US')}\``, inline: true },
      { name: '🧪 Kho AP Đầu', value: `\`${shift.startAP.toLocaleString('en-US')} AP\``, inline: true }
    )
    .setFooter({ text: 'Gửi "!end" kèm 3 ảnh kết thúc hoặc "!cancel" để hủy' });

  await message.reply({ embeds: [embed] });
}

// ── 6. Handle !cancel ────────────────────────────────────────────────────────

async function handleCancel(message: Message) {
  const cancelled = shiftManager.cancelShift(message.author.id);
  if (cancelled) {
    await message.reply('🛑 Đã hủy ca làm hiện tại của bạn. Dữ liệu chưa lưu vào báo cáo.');
  } else {
    await message.reply('ℹ️ Bạn không có ca làm nào đang chạy.');
  }
}

// ── 7. Handle !help / !huongdan ──────────────────────────────────────────────

async function handleHelp(message: Message) {
  const embed = new EmbedBuilder()
    .setTitle('📖 HƯỚNG DẪN SỬ DỤNG BOT LÀM REPORT (DÀNH CHO NGƯỜI MỚI)')
    .setColor(0x3b82f6)
    .setDescription(
      `Chào mừng bạn đến với hệ thống hỗ trợ Pilot Rise of Kingdoms!\n` +
      `Bot AI tự động nhận diện ảnh chụp màn hình, tính giờ làm, quét AP/Danh dự/Tăng tốc, và ghi nhận bảng lương.\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    )
    .addFields(
      {
        name: '🎯 QUY TRÌNH 4 BƯỚC CHO PILOT (NGƯỜI LÀM)',
        value:
          `**1️⃣ Bắt Đầu Ca:**\n` +
          `• Gõ lệnh: \`!start [ghi chú]\` kèm **3 ảnh đầu ca** (Ví dụ: \`!start 5 marches cày pháo đài\`).\n\n` +
          `**2️⃣ Trong Khi Đang Làm:**\n` +
          `• \`!status\` : Kiểm tra ca làm hiện tại, xem đã chạy được mấy tiếng.\n` +
          `• \`!cancel\` : Hủy ca làm nếu lỡ ấn nhầm.\n\n` +
          `**3️⃣ Kết Thúc Ca:**\n` +
          `• Gõ lệnh: \`!end [ghi chú]\` kèm **3 ảnh cuối ca** (Ví dụ: \`!end xong ca 5h\`).\n` +
          `• Bot sẽ tính toán đầy đủ: giờ làm VN & ROK, AP tiêu thụ, quái diệt, hiệu suất %, xếp loại SS/S/A/B, tăng tốc và lưu vào hệ thống chấm công.\n\n` +
          `**4️⃣ Tra Cứu Công Của Mình:**\n` +
          `• \`!salary\` hoặc \`!luong\` : Xem tổng số ca và tổng số giờ làm của **BẢN THÂN** trong tháng.\n` +
          `• ⚠️ *Lưu ý:* Mỗi Pilot được tra cứu tối đa **2 lần / ngày** (reset lúc 00:00).`,
        inline: false,
      },
      {
        name: '📸 3 ẢNH BẮT BUỘC ĐÍNH KÈM (ĐẦU CA & CUỐI CA)',
        value:
          `Mỗi lần \`!start\` hoặc \`!end\`, BẮT BUỘC đính kèm đủ **3 ảnh** chụp trong game:\n` +
          `1. 🎖️ **Bảng Điểm Danh Dự (Honor Board)** - Hiển thị tên tài khoản & số điểm.\n` +
          `2. 🧪 **Kho Bình AP trong Túi Đồ** - Các bình AP 50, 100, 500, 1000.\n` +
          `3. ⚡ **Kho Tăng Tốc trong Túi Đồ** - Tăng tốc Chung, Luyện lính, Chữa lính.`,
        inline: false,
      },
      {
        name: '👑 LỆNH DÀNH RIÊNG CHO BOSS / QUẢN TRỊ VIÊN',
        value:
          `• \`!excel [tháng]\` : Xuất file Excel (.xlsx) đầy đủ tất cả nhân viên + bảng tự động tính tiền lương.\n` +
          `  *(Ví dụ: \`!excel\` hoặc \`!excel 10/2026\` hoặc \`!excel all\`)*\n` +
          `• \`!salary all [tháng]\` : Xem tổng hợp bảng công của toàn bộ đội ngũ.\n` +
          `• \`!salary @pilot [tháng]\` : Xem chi tiết ca làm của một nhân viên bất kỳ.\n` +
          `• \`!setboss @user\` : Phong quyền Boss cho một thành viên.\n` +
          `• \`!setpilot @user\` : Xác nhận vai trò Pilot cho thành viên.\n` +
          `• \`!roles\` : Xem danh sách tất cả Boss và Pilot trong hệ thống.`,
        inline: false,
      },
      {
        name: '💡 MẸO & LƯU Ý ĐỂ TRÁNH LỖI',
        value:
          `• Chụp ảnh màn hình rõ ràng, không bị che số AP hoặc điểm danh dự.\n` +
          `• Đính kèm đủ cả 3 ảnh trong 1 tin nhắn cùng với lệnh \`!start\` hoặc \`!end\`.\n` +
          `• Gõ \`!huongdan\` hoặc \`!help\` bất kỳ lúc nào để xem lại bảng hướng dẫn này.`,
        inline: false,
      }
    )
    .setFooter({ text: 'AP Efficiency Analyzer · ROK Pilot Bot' })
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}

// ── 8. Handle Role Management (!setboss, !setpilot, !roles, ...) ────────────

async function handleSetBoss(message: Message) {
  if (!isBoss(message)) {
    await message.reply('⛔ **Quyền truy cập bị từ chối!** Chỉ Boss hoặc Quản trị viên mới có thể phong vai trò Boss.');
    return;
  }

  const targetUser = message.mentions.users.first() || message.author;
  const targetMember = message.mentions.members?.first() || message.member;

  roleManager.addBoss(targetUser.id);

  // Attempt to assign Discord role if available
  let discordRoleNote = '';
  if (message.guild && targetMember) {
    const bossRole = message.guild.roles.cache.find(
      (r) => r.name.toLowerCase() === 'boss' || r.name.toLowerCase() === 'quản lý'
    );
    if (bossRole) {
      try {
        await targetMember.roles.add(bossRole);
        discordRoleNote = `\n👑 *Đã tự động gắn Role Discord **${bossRole.name}** cho thành viên!*`;
      } catch {
        discordRoleNote = `\n*(Lưu ý: Để bot tự gán role Discord, hãy kéo role của Bot lên cao hơn role ${bossRole.name} trong cài đặt máy chủ).*`;
      }
    }
  }

  const embed = new EmbedBuilder()
    .setTitle('👑 ĐÃ PHONG VAI TRÒ BOSS THÀNH CÔNG')
    .setColor(0xf59e0b)
    .setDescription(
      `Thành viên <@${targetUser.id}> (**${targetUser.username}**) đã được cấp quyền **Boss**!${discordRoleNote}\n\n` +
      `**Các quyền được mở khóa:**\n` +
      `• Xuất file Excel (\`!excel\`) chứa toàn bộ ca làm & tính lương của cả đội.\n` +
      `• Xem bảng công của mọi nhân viên (\`!salary all\` hoặc \`!salary @pilot\`).\n` +
      `• Tra cứu lương không giới hạn lượt.\n` +
      `• Phân quyền Boss và Pilot cho người khác (\`!setboss\`, \`!setpilot\`).`
    )
    .setFooter({ text: 'Hệ thống phân quyền · AP Efficiency Bot' })
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}

async function handleRemoveBoss(message: Message) {
  if (!isBoss(message)) {
    await message.reply('⛔ **Quyền truy cập bị từ chối!**');
    return;
  }

  const targetUser = message.mentions.users.first();
  const targetMember = message.mentions.members?.first();

  if (!targetUser) {
    await message.reply('⚠️ Cú pháp: `!removeboss @user`');
    return;
  }

  if (message.guild && message.guild.ownerId === targetUser.id) {
    await message.reply('❌ Không thể hủy quyền Boss của Chủ Server Discord!');
    return;
  }

  roleManager.removeBoss(targetUser.id);

  if (message.guild && targetMember) {
    const bossRole = message.guild.roles.cache.find(
      (r) => r.name.toLowerCase() === 'boss' || r.name.toLowerCase() === 'quản lý'
    );
    if (bossRole) {
      try {
        await targetMember.roles.remove(bossRole);
      } catch {
        // ignore
      }
    }
  }

  await message.reply(`🛑 Đã hủy quyền Boss của <@${targetUser.id}>. Thành viên này quay về quyền Pilot thông thường.`);
}

async function handleSetPilot(message: Message) {
  if (!isBoss(message)) {
    await message.reply('⛔ **Quyền truy cập bị từ chối!** Chỉ Boss mới có thể phân quyền Pilot.');
    return;
  }

  const targetUser = message.mentions.users.first() || message.author;
  const targetMember = message.mentions.members?.first() || message.member;

  roleManager.addPilot(targetUser.id);

  let discordRoleNote = '';
  if (message.guild && targetMember) {
    const pilotRole = message.guild.roles.cache.find(
      (r) => r.name.toLowerCase() === 'pilot'
    );
    if (pilotRole) {
      try {
        await targetMember.roles.add(pilotRole);
        discordRoleNote = `\n🎮 *Đã tự động gắn Role Discord **${pilotRole.name}** cho thành viên!*`;
      } catch {
        discordRoleNote = `\n*(Lưu ý: Để bot tự gán role Discord, hãy kéo role của Bot lên cao hơn role ${pilotRole.name} trong cài đặt máy chủ).*`;
      }
    }
  }

  const embed = new EmbedBuilder()
    .setTitle('🎮 ĐÃ GÁN VAI TRÒ PILOT THÀNH CÔNG')
    .setColor(0x10b981)
    .setDescription(
      `Thành viên <@${targetUser.id}> (**${targetUser.username}**) đã được xác nhận vai trò **Pilot**!${discordRoleNote}\n\n` +
      `**Quy trình làm việc của Pilot:**\n` +
      `• Gõ \`!start\` kèm 3 ảnh bắt đầu ca làm.\n` +
      `• Gõ \`!end\` kèm 3 ảnh kết thúc ca làm.\n` +
      `• Gõ \`!salary\` để tra cứu số giờ và công của bản thân (tối đa 2 lần/ngày).\n` +
      `• Gõ \`!huongdan\` để xem hướng dẫn chi tiết.`
    )
    .setFooter({ text: 'Hệ thống quản lý Pilot · AP Efficiency Bot' })
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}

async function handleRemovePilot(message: Message) {
  if (!isBoss(message)) {
    await message.reply('⛔ **Quyền truy cập bị từ chối!**');
    return;
  }

  const targetUser = message.mentions.users.first();
  const targetMember = message.mentions.members?.first();

  if (!targetUser) {
    await message.reply('⚠️ Cú pháp: `!removepilot @user`');
    return;
  }

  roleManager.removePilot(targetUser.id);

  if (message.guild && targetMember) {
    const pilotRole = message.guild.roles.cache.find(
      (r) => r.name.toLowerCase() === 'pilot'
    );
    if (pilotRole) {
      try {
        await targetMember.roles.remove(pilotRole);
      } catch {
        // ignore
      }
    }
  }

  await message.reply(`🛑 Đã hủy vai trò Pilot của <@${targetUser.id}>.`);
}

async function handleListRoles(message: Message) {
  const bosses = roleManager.getBossList();
  const pilots = roleManager.getPilotList();

  const bossText =
    bosses.length > 0
      ? bosses.map((id, i) => `${i + 1}. <@${id}> (\`${id}\`)`).join('\n')
      : '*(Chưa có Boss nào được thêm thủ công. Chủ server & Admin tự động có quyền Boss)*';

  const pilotText =
    pilots.length > 0
      ? pilots.map((id, i) => `${i + 1}. <@${id}> (\`${id}\`)`).join('\n')
      : '*(Chưa có danh sách Pilot thủ công. Mọi thành viên chạy !start/!end đều được tính công)*';

  const embed = new EmbedBuilder()
    .setTitle('👥 DANH SÁCH PHÂN QUYỀN VAI TRÒ (ROLES)')
    .setColor(0x3b82f6)
    .addFields(
      { name: '👑 Danh Sách Boss / Quản Lý', value: bossText, inline: false },
      { name: '🎮 Danh Sách Pilot / Nhân Viên', value: pilotText, inline: false },
      {
        name: '⚙️ Lệnh Quản Trị Vai Trò (Dành cho Boss)',
        value:
          `• \`!setboss @user\` : Thêm một thành viên làm Boss\n` +
          `• \`!removeboss @user\` : Hủy quyền Boss\n` +
          `• \`!setpilot @user\` : Đăng ký vai trò Pilot\n` +
          `• \`!removepilot @user\` : Hủy vai trò Pilot\n` +
          `• \`!roles\` : Xem bảng phân quyền này`,
        inline: false,
      }
    )
    .setFooter({ text: 'AP Efficiency Bot · Quản lý vai trò nhân sự' })
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getAttachedImageUrls(message: Message): string[] {
  const urls: string[] = [];
  for (const [, att] of message.attachments) {
    const isImage =
      att.contentType?.startsWith('image/') ||
      /\.(png|jpe?g|webp)$/i.test(att.name || '');
    if (isImage && att.url) {
      urls.push(att.url);
    }
  }
  return urls;
}

// ── Start Bot ────────────────────────────────────────────────────────────────

export async function startBot() {
  const config = validateConfig();
  if (!config.valid) {
    console.error('❌ Không thể khởi động bot vì thiếu cấu hình:');
    for (const err of config.errors) {
      console.error(`  - ${err}`);
    }
    console.error('\n👉 Vui lòng tạo file .env với nội dung:');
    console.error('DISCORD_BOT_TOKEN=your_bot_token_here');
    console.error('GEMINI_API_KEY=your_gemini_api_key_here');
    return;
  }

  try {
    // Start lightweight HTTP keep-alive server for Render / cloud hosting
    const PORT = process.env.PORT || 3000;
    http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'online',
          bot: client.user?.tag || 'connecting...',
          uptime: Math.floor(process.uptime()),
        })
      );
    }).listen(Number(PORT), '0.0.0.0', () => {
      console.log(`🌐 HTTP Keep-alive server running on port ${PORT}`);
    });

    console.log('🔄 Đang kết nối tới Discord Gateway...');
    await client.login(DISCORD_BOT_TOKEN);
  } catch (err) {
    console.error('❌ Đăng nhập Discord thất bại:', err);
  }
}

// Always start the bot on launch
startBot();
