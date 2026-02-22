/**
 * Brandon's Agent - Telegram Bot (Open Claw)
 *
 * Connects Brandon's Agent to Telegram so it can receive
 * and respond to messages in the Open Claw bot.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { Telegraf, Markup } = require('telegraf');
const BrandonsAgent = require('./index');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error('Missing TELEGRAM_BOT_TOKEN in .env file.');
  console.error('Get your token from @BotFather on Telegram and add it to agents/brandons-agent/.env');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const agent = new BrandonsAgent();

// ── Startup log ──────────────────────────────────────────────
console.log('Agent loaded:', JSON.stringify(agent.getInfo(), null, 2));

// ── /start command ───────────────────────────────────────────
bot.start((ctx) => {
  const name = ctx.from.first_name || 'there';
  ctx.reply(
    `Hey ${name}! I'm Brandon's Agent for NF6 Family Office.\n\n` +
    `Here's what I can do:\n` +
    `/bookings — View current bookings\n` +
    `/revenue — Financial summary\n` +
    `/calculate — Calculate net income for a booking\n` +
    `/properties — Property details\n` +
    `/help — Show this menu\n\n` +
    `Or just send me a message and I'll do my best to help.`
  );
});

// ── /help command ────────────────────────────────────────────
bot.help((ctx) => {
  ctx.reply(
    `📋 *Brandon's Agent Commands*\n\n` +
    `/bookings — View all current bookings\n` +
    `/revenue — YTD financial summary\n` +
    `/calculate <nights> <rate> — Calculate net income\n` +
    `/properties — View property details\n` +
    `/status — Agent status\n` +
    `/help — Show this menu`,
    { parse_mode: 'Markdown' }
  );
});

// ── /status command ──────────────────────────────────────────
bot.command('status', (ctx) => {
  const info = agent.getInfo();
  ctx.reply(
    `*Agent Status*\n\n` +
    `Name: ${info.name}\n` +
    `Version: ${info.version}\n` +
    `Status: ${info.status}\n` +
    `Capabilities: ${info.capabilities.join(', ')}\n` +
    `Knowledge files: ${info.knowledgeFiles.join(', ')}`,
    { parse_mode: 'Markdown' }
  );
});

// ── /bookings command ────────────────────────────────────────
bot.command('bookings', (ctx) => {
  ctx.reply(
    `*Current Bookings (2025-2026)*\n\n` +
    `1. *David Frayer*\n` +
    `   Jan 2 – Jan 17, 2025 | 16 nights @ $450\n` +
    `   Gross: $7,200 | Net: $5,510\n\n` +
    `2. *Emily Levine*\n` +
    `   Jan 25 – Feb 1, 2025 | 7 nights @ $1,500\n` +
    `   Gross: $10,500 | Net: $8,150\n\n` +
    `3. *Jon Warwick*\n` +
    `   Feb 8 – Mar 10, 2025 | 30 nights @ $567\n` +
    `   Gross: $17,000 | Net: $13,350\n\n` +
    `4. *Billy Shroyer*\n` +
    `   Mar 21 – Mar 27, 2025 | 6 nights @ $1,700\n` +
    `   Gross: $10,200 | Net: $7,910`,
    { parse_mode: 'Markdown' }
  );
});

// ── /revenue command ─────────────────────────────────────────
bot.command('revenue', (ctx) => {
  ctx.reply(
    `*NF6 Family Office — YTD Revenue Summary*\n\n` +
    `Property: Villa Lynn\n\n` +
    `Gross Revenue: $44,900\n` +
    `Platform Fees (20%): -$8,980\n` +
    `Cleaning Fees (4 bookings): -$1,000\n` +
    `*Net Income: $34,920*\n\n` +
    `Occupancy: 66%\n` +
    `Total Nights Booked: 59\n` +
    `Avg Nightly Rate: $761`,
    { parse_mode: 'Markdown' }
  );
});

// ── /properties command ──────────────────────────────────────
bot.command('properties', (ctx) => {
  ctx.reply(
    `*Properties*\n\n` +
    `🏠 *Villa Lynn*\n` +
    `Type: Vacation rental\n` +
    `Platform Fee: 20%\n` +
    `Cleaning Fee: $250/booking\n` +
    `Pricing: Variable nightly rates\n` +
    `YTD Occupancy: 66%`,
    { parse_mode: 'Markdown' }
  );
});

// ── /calculate command ───────────────────────────────────────
bot.command('calculate', (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);

  if (args.length < 2) {
    ctx.reply(
      `Usage: /calculate <nights> <rate>\n\n` +
      `Example: /calculate 10 500\n` +
      `(Calculates net income for 10 nights at $500/night)`
    );
    return;
  }

  const nights = parseInt(args[0], 10);
  const rate = parseFloat(args[1]);

  if (isNaN(nights) || isNaN(rate) || nights <= 0 || rate <= 0) {
    ctx.reply('Please provide valid numbers. Example: /calculate 10 500');
    return;
  }

  const result = agent.calculateNetIncome({ nights, rate });

  ctx.reply(
    `*Booking Calculation*\n\n` +
    `Nights: ${nights}\n` +
    `Rate: $${rate.toLocaleString()}/night\n\n` +
    `Gross Revenue: $${result.gross.toLocaleString()}\n` +
    `Platform Fee (20%): -$${result.platformFee.toLocaleString()}\n` +
    `Cleaning Fee: -$${result.cleaningFee.toLocaleString()}\n` +
    `*Net Income: $${result.net.toLocaleString()}*`,
    { parse_mode: 'Markdown' }
  );
});

// ── Free-text messages ───────────────────────────────────────
bot.on('text', (ctx) => {
  const msg = ctx.message.text.toLowerCase();

  if (msg.includes('booking') || msg.includes('guest')) {
    ctx.reply(
      'Use /bookings to see all current bookings, or /calculate <nights> <rate> to run the numbers on a new one.'
    );
  } else if (msg.includes('revenue') || msg.includes('income') || msg.includes('money') || msg.includes('financial')) {
    ctx.reply(
      'Use /revenue for the full YTD financial summary, or /calculate to run numbers on a specific booking.'
    );
  } else if (msg.includes('property') || msg.includes('villa')) {
    ctx.reply('Use /properties to see details on all managed properties.');
  } else if (msg.includes('hello') || msg.includes('hi') || msg.includes('hey')) {
    const name = ctx.from.first_name || 'there';
    ctx.reply(`Hey ${name}! Use /help to see what I can do.`);
  } else {
    ctx.reply(
      `I'm Brandon's Agent for NF6 Family Office. I can help with:\n\n` +
      `• Bookings & guest data\n` +
      `• Revenue & financial calculations\n` +
      `• Property information\n\n` +
      `Use /help to see all commands.`
    );
  }
});

// ── Error handling ───────────────────────────────────────────
bot.catch((err, ctx) => {
  console.error(`Error for ${ctx.updateType}:`, err);
  ctx.reply('Something went wrong. Please try again.');
});

// ── Launch ───────────────────────────────────────────────────
bot.launch()
  .then(() => {
    console.log('Brandon\'s Agent is live on Telegram (Open Claw).');
  })
  .catch((err) => {
    console.error('Failed to launch bot:', err.message);
    process.exit(1);
  });

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
