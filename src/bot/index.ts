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
  console.log(`⚡ Sẵn sàng nhận lệnh: !start, !end, !excel, !luong, !status, !cancel, !help`);
  console.log(`================================================`);
});

// ── Command Handlers ─────────────────────────────────────────────────────────

client.on('messageCreate', async (message: Message) => {
  if (message.author.bot) return;

  const content = message.content.trim();
  const lower = content.toLowerCase();

  // Command: !help
  if (lower === '!help') {
    await handleHelp(message);
    return;
  }

  // Command: !excel [month]
  if (lower.startsWith('!excel') || lower.startsWith('!export')) {
    await handleExcel(message);
    return;
  }

  // Command: !luong [month] or !salary
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
      .setDescription(`Đã ghi nhận dữ liệu ban đầu cho Pilot **${pilotName}**!`)
      .addFields(
        {
          name: '👤 Pilot & Tài Khoản',
          value: `**Pilot:** \`${pilotName}\`\n**Account:** \`${scan.accountName}\`\n**Ghi chú:** \`${note}\``,
          inline: false,
        },
        {
          name: '⏰ Giờ Bắt Đầu',
          value: `🇻🇳 **UTC+7 (Việt Nam):** \`${startVN}\`\n🎮 **ROK Game Time:** \`${startROK}\``,
          inline: true,
        },
        {
          name: '🎖️ Danh Dự Ban Đầu',
          value: `\`${scan.honorValue.toLocaleString('en-US')}\` Điểm`,
          inline: true,
        },
        {
          name: '🧪 Kho Bình AP Ban Đầu',
          value: `**${scan.totalAP.toLocaleString('en-US')}** AP\n*(50x${scan.ap50} · 100x${scan.ap100} · 500x${scan.ap500} · 1kx${scan.ap1000})*`,
          inline: false,
        },
        {
          name: '⚡ Tăng Tốc Ban Đầu',
          value: `Universal: \`${uDays}d ${uHours}h\` · Training: \`${Math.floor(scan.trainingMinutes / 1440)}d\` · Healing: \`${Math.floor(scan.healingMinutes / 1440)}d\``,
          inline: false,
        }
      )
      .setFooter({ text: 'Khi kết thúc ca làm, hãy gửi "!end" kèm 3 ảnh kết thúc để tạo Báo Cáo' })
      .setTimestamp();

    await statusMsg.edit({ content: '', embeds: [embed] });
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
      '⚠️ **Chưa có Gemini API Key!**\n' +
      'Vui lòng gõ lệnh: `!setkey <key_của_bạn>` để kích hoạt quét ảnh AI (Lấy key miễn phí tại: https://aistudio.google.com/app/apikey)'
    );
    return;
  }

  const shift = shiftManager.getShift(message.author.id);

  if (!shift) {
    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('⚠️ Chưa Bắt Đầu Ca Làm')
          .setColor(0xef4444)
          .setDescription(
            `Bạn chưa có ca làm nào đang chạy!\n\n` +
            `👉 Hãy gửi lệnh \`!start\` kèm **3 ảnh ban đầu** để bắt đầu ca làm mới.`
          ),
      ],
    });
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
            `1. 🎖️ **Bảng Danh Dự** (Đợt sau)\n` +
            `2. 🧪 **Kho Bình AP** (Đợt sau)\n` +
            `3. ⚡ **Kho Tăng Tốc** (Đợt sau)`
          ),
      ],
    });
    return;
  }

  const overrideNote = message.content.slice('!end'.length).trim();
  const statusMsg = await message.reply('⏳ **Đang phân tích 3 ảnh kết thúc và tính toán hiệu suất...**');

  try {
    const endScan = await scanBatchScreenshots(images);
    const endTime = Date.now();

    const reportData = computeShiftReport(shift, endScan, endTime, overrideNote);

    // Save completed shift to monthly history database
    const dateStr = formatVNDate(endTime);
    const monthStr = formatVNMonth(endTime);

    const completed: CompletedShift = {
      id: `shift_${endTime}_${message.author.id}`,
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
      efficiencyRate: Math.round(reportData.efficiencyRate * 10) / 10,
      efficiencyGrade: reportData.efficiencyTier.grade,
      universalSpeed: reportData.universalSpeed,
      trainingSpeed: reportData.trainingSpeed,
      healingSpeed: reportData.healingSpeed,
      createdAt: endTime,
    };
    shiftManager.saveCompletedShift(completed);

    // Remove shift from active manager
    shiftManager.endShift(message.author.id);

    // Generate updated monthly Excel file
    let excelAttachment: AttachmentBuilder | null = null;
    try {
      const monthShifts = shiftManager.getCompletedShifts(monthStr);
      const excel = await generateMonthlyExcelReport(monthShifts, {
        monthFilter: monthStr,
        now: endTime,
      });
      excelAttachment = new AttachmentBuilder(excel.buffer, { name: excel.fileName });
    } catch (excelErr) {
      console.error('Lỗi tạo file Excel trong !end:', excelErr);
    }

    const embed = buildReportEmbed(reportData);

    // Reply with Embed, Excel File Attachment, and Monospace Text
    await statusMsg.edit({
      content: `✅ **Ca làm đã hoàn tất! Đã tự động lưu vào sổ lương Tháng ${monthStr}:**`,
      embeds: [embed],
      files: excelAttachment ? [excelAttachment] : [],
    });

    // Send pure text block for easy mobile copy
    await message.reply({
      content: `\`\`\`\n${reportData.reportText}\n\`\`\`\n📊 *File Excel tính lương tháng đã được đính kèm ở tin nhắn trên. Gõ lệnh \`!excel\` để tải toàn bộ bảng tính bất kỳ lúc nào.*`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Lỗi khi xử lý !end:', err);
    await statusMsg.edit(`❌ **Lỗi khi tính toán báo cáo:** ${msg}`);
  }
}

// ── 3. Handle !excel ─────────────────────────────────────────────────────────

async function handleExcel(message: Message) {
  const content = message.content.trim();
  const rawArg = content.replace(/^!(?:excel|export)/i, '').trim();

  const now = Date.now();
  const currentMonthStr = formatVNMonth(now);
  const targetMonth = rawArg || currentMonthStr;

  const statusMsg = await message.reply('⏳ **Đang tổng hợp dữ liệu ca làm và xuất file Excel...**');

  try {
    const shifts = shiftManager.getCompletedShifts(targetMonth);

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
      .setFooter({ text: 'AP Efficiency Bot · Excel Payroll Generator' })
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

// ── 4. Handle !luong ─────────────────────────────────────────────────────────

async function handleLuong(message: Message) {
  const content = message.content.trim();
  const rawArg = content.replace(/^!(?:luong|salary)/i, '').trim();
  const now = Date.now();
  const targetMonth = rawArg || formatVNMonth(now);

  const shifts = shiftManager.getCompletedShifts(targetMonth);
  if (shifts.length === 0) {
    const available = shiftManager.getAvailableMonths();
    const availableText = available.length > 0 ? available.join(', ') : 'Chưa có tháng nào';
    await message.reply(
      `ℹ️ Chưa có ca làm nào trong kỳ **${targetMonth}**.\n` +
      `Các tháng hiện có dữ liệu: \`${availableText}\``
    );
    return;
  }

  // Group by pilot
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
    .setTitle(`💰 TỔNG HỢP CÔNG PILOT - THÁNG ${targetMonth}`)
    .setColor(0x06b6d4)
    .setDescription(lines.join('\n\n'))
    .addFields(
      { name: '👥 Nhân Viên', value: `${pilotMap.size} người`, inline: true },
      { name: '📋 Tổng Ca Làm', value: `${shifts.length} ca`, inline: true },
      { name: '⏳ Tổng Giờ Toàn Đội', value: `${totalHours} giờ`, inline: true }
    )
    .setFooter({ text: 'Gõ !excel để tải file Excel chi tiết có công thức tính lương tự động' })
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

// ── 4. Handle !cancel ────────────────────────────────────────────────────────

async function handleCancel(message: Message) {
  const cancelled = shiftManager.cancelShift(message.author.id);
  if (cancelled) {
    await message.reply('🛑 Đã hủy ca làm hiện tại của bạn. Dữ liệu chưa lưu vào báo cáo.');
  } else {
    await message.reply('ℹ️ Bạn không có ca làm nào đang chạy.');
  }
}

// ── 5. Handle !help ──────────────────────────────────────────────────────────

async function handleHelp(message: Message) {
  const embed = new EmbedBuilder()
    .setTitle('📖 HƯỚNG DẪN SỬ DỤNG BOT LÀM REPORT DISCORD')
    .setColor(0x5865f2)
    .setDescription(
      `Bot tự động tính toán giờ làm (UTC+7 / ROK Game Time), quét điểm Danh Dự, bình AP, tăng tốc, xuất báo cáo và lưu bảng tính lương Excel (.xlsx).\n\n` +
      `**CÁC LỆNH CHÍNH:**\n` +
      `• \`!start [ghi chú]\` + đính kèm 3 ảnh: Bắt đầu ca làm việc.\n` +
      `• \`!end [ghi chú]\` + đính kèm 3 ảnh: Kết thúc ca làm ➜ Tự động xuất báo cáo & file Excel.\n` +
      `• \`!excel [tháng]\`: Tải file Excel chi tiết ca làm & bảng tính lương (Ví dụ: \`!excel 10/2026\` hoặc \`!excel all\`).\n` +
      `• \`!luong [tháng]\`: Xem nhanh tổng hợp số giờ làm và ca làm của từng nhân viên.\n` +
      `• \`!status\`: Xem tiến độ ca làm hiện tại và số giờ đã trôi qua.\n` +
      `• \`!cancel\`: Hủy ca làm hiện tại.\n` +
      `• \`!help\`: Xem hướng dẫn này.\n\n` +
      `**3 ẢNH BẮT BUỘC ĐÍNH KÈM:**\n` +
      `1. 🎖️ Bảng Danh Dự (Honor Board)\n` +
      `2. 🧪 Kho Bình AP (AP Potions)\n` +
      `3. ⚡ Kho Tăng Tốc (Speedups)`
    )
    .setFooter({ text: 'AP Efficiency Analyzer · ROK Pilot Bot' });

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
