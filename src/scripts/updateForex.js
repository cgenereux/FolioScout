import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..', '..');

const FOREX_FILE = path.join(ROOT_DIR, 'data/forex/usdcad.json');

function log(msg) {
  console.log(`[updateForex] ${msg}`);
}

function getTiingoToken() {
  const token = process.env.TIINGO_TOKEN;
  return token && token.trim() ? token.trim() : null;
}

async function readJsonFile(filePath) {
  try {
    const text = await fs.readFile(filePath, 'utf8');
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function writeForexFile(filePath, rows) {
  const lines = ['['];
  for (let i = 0; i < rows.length; i++) {
    const [date, rate] = rows[i];
    const comma = i === rows.length - 1 ? '' : ',';
    lines.push(`["${date}",${rate}]${comma}`);
  }
  lines.push(']');
  await fs.writeFile(filePath, lines.join('\n') + '\n', 'utf8');
}

async function fetchTiingoForex(startDate, token) {
  const url =
    `https://api.tiingo.com/tiingo/fx/usdcad/prices` +
    `?startDate=${encodeURIComponent(startDate)}` +
    `&resampleFreq=1day` +
    `&token=${encodeURIComponent(token)}`;

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    log(`Tiingo HTTP ${res.status} ${body ? `- ${body.slice(0, 140)}` : ''}`);
    return null;
  }

  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) {
    log('Tiingo returned empty forex data');
    return null;
  }

  const rows = [];
  for (const item of data) {
    const date = String(item.date || '').slice(0, 10);
    const rate = item.close;
    if (date && typeof rate === 'number') {
      rows.push([date, Math.round(rate * 10000) / 10000]);
    }
  }

  rows.sort((a, b) => a[0].localeCompare(b[0]));
  return rows.length ? rows : null;
}

function subtractDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const token = getTiingoToken();
  if (!token) {
    log('Missing TIINGO_TOKEN env var');
    process.exitCode = 1;
    return;
  }

  const existingRows = (await readJsonFile(FOREX_FILE)) || [];
  const map = new Map();
  for (const row of existingRows) {
    if (Array.isArray(row) && typeof row[0] === 'string' && typeof row[1] === 'number') {
      map.set(row[0], row[1]);
    }
  }

  const lastDate = existingRows.length ? existingRows[existingRows.length - 1][0] : null;
  const startDate = lastDate ? subtractDays(lastDate, 7) : '2021-01-01';

  log(`Fetching USD/CAD rates from ${startDate}...`);

  const newRows = await fetchTiingoForex(startDate, token);
  if (!newRows) {
    log('No new forex data fetched');
    return;
  }

  for (const [date, rate] of newRows) {
    map.set(date, rate);
  }

  const merged = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  await fs.mkdir(path.dirname(FOREX_FILE), { recursive: true });
  await writeForexFile(FOREX_FILE, merged);

  log(`Updated usdcad.json (${merged.length} rows)`);
}

main();
