import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..', '..');

const DATA_DIR = path.join(ROOT_DIR, 'data/stockPriceHistory');
const META_FILE = path.join(DATA_DIR, '_last_update.json');

const PRICE_SOURCE = 'tiingo';
const sharedConfig = globalThis.FolioScoutConfig || {};
const useAlphaVantageTickers = Array.isArray(sharedConfig.useAlphaVantageTickers)
  ? sharedConfig.useAlphaVantageTickers
  : [];
const alphaVantageSymbolByTicker = sharedConfig.alphaVantageSymbolByTicker || {};
const alphaVantageTickerSet = new Set(useAlphaVantageTickers.map((ticker) => ticker.toUpperCase()));

function log(msg) {
  console.log(`[updateStockPrices] ${msg}`);
}

function getTodayDateStrNY() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const values = {};
  for (const part of parts) {
    if (part.type !== 'literal') values[part.type] = part.value;
  }

  return `${values.year}-${values.month}-${values.day}`;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const tickersIndex = args.indexOf('--tickers');
  const tickersText = tickersIndex !== -1 ? args[tickersIndex + 1] : null;
  const tickers =
    typeof tickersText === 'string' && tickersText.trim()
      ? tickersText
          .split(',')
          .map((t) => t.trim().toUpperCase())
          .filter(Boolean)
      : null;
  return {
    force: args.includes('--force'),
    tickers,
  };
}

async function fileExists(filePath) {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonFile(filePath) {
  try {
    const text = await fs.readFile(filePath, 'utf8');
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function writeJsonFilePretty(filePath, data) {
  const text = JSON.stringify(data, null, 2) + '\n';
  await fs.writeFile(filePath, text, 'utf8');
}

async function writePriceHistoryFile(filePath, rows) {
  const lines = ['['];

  for (let i = 0; i < rows.length; i++) {
    const date = rows[i][0];
    const price = rows[i][1];
    const comma = i === rows.length - 1 ? '' : ',';
    lines.push(`  ["${date}",${price}]${comma}`);
  }

  lines.push(']');
  await fs.writeFile(filePath, lines.join('\n') + '\n', 'utf8');
}

function getTiingoToken() {
  const token = process.env.TIINGO_TOKEN;
  return token && token.trim() ? token.trim() : null;
}

function getFmpKey() {
  const key = process.env.FMP_API_KEY;
  return key && key.trim() ? key.trim() : null;
}

function getAlphaVantageKey() {
  const key = process.env.ALPHA_VANTAGE_API_KEY;
  return key && key.trim() ? key.trim() : null;
}

async function getTickersToUpdate() {
  if (await fileExists(path.join(ROOT_DIR, 'data/trades.json'))) {
    const trades = await readJsonFile(path.join(ROOT_DIR, 'data/trades.json'));
    const tickers = new Set();
    for (const trade of trades || []) {
      if (trade && trade.ticker) tickers.add(String(trade.ticker).toUpperCase());
    }
    return [...tickers].sort();
  }

  const files = await fs.readdir(DATA_DIR);
  const tickers = files
    .filter((f) => f.endsWith('.json'))
    .filter((f) => f !== '_last_update.json')
    .map((f) => f.replace(/\.json$/, '').toUpperCase());

  return [...new Set(tickers)].sort();
}

function subtractDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

async function fetchTiingoPrices(ticker, startDate, token) {
  const url =
    `https://api.tiingo.com/tiingo/daily/${encodeURIComponent(ticker)}` +
    `/prices?startDate=${encodeURIComponent(startDate)}` +
    `&token=${encodeURIComponent(token)}`;

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    log(`${ticker}: Tiingo HTTP ${res.status} ${body ? `- ${body.slice(0, 140)}` : ''}`);
    return null;
  }

  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) {
    log(`${ticker}: Tiingo returned empty data`);
    return null;
  }

  const rows = [];
  for (const item of data) {
    const date = String(item.date || '').slice(0, 10);
    const price = item.adjClose;
    if (date && typeof price === 'number') rows.push([date, price]);
  }

  rows.sort((a, b) => a[0].localeCompare(b[0]));
  return rows.length ? rows : null;
}

async function fetchFmpPrices(ticker, startDate, key) {
  const url =
    `https://financialmodelingprep.com/stable/historical-price-eod/full` +
    `?symbol=${encodeURIComponent(ticker)}` +
    `&apikey=${encodeURIComponent(key)}`;

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    log(`${ticker}: FMP HTTP ${res.status} ${body ? `- ${body.slice(0, 140)}` : ''}`);
    return null;
  }

  const json = await res.json();
  const rowsRaw = Array.isArray(json) ? json : json?.historical;
  if (!Array.isArray(rowsRaw) || rowsRaw.length === 0) {
    log(`${ticker}: FMP returned empty data`);
    return null;
  }

  const rows = [];
  for (const item of rowsRaw) {
    const date = String(item.date || '').slice(0, 10);
    const price = item.adjClose ?? item.close ?? item.price;
    if (date && typeof price === 'number' && date >= startDate) {
      rows.push([date, price]);
    }
  }

  rows.sort((a, b) => a[0].localeCompare(b[0]));
  return rows.length ? rows : null;
}

async function fetchAlphaVantagePrices(symbol, startDate, key) {
  const url =
    `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY` +
    `&outputsize=compact` +
    `&symbol=${encodeURIComponent(symbol)}` +
    `&apikey=${encodeURIComponent(key)}`;

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    log(`${symbol}: Alpha Vantage HTTP ${res.status} ${body ? `- ${body.slice(0, 140)}` : ''}`);
    return null;
  }

  const json = await res.json();
  if (typeof json?.['Error Message'] === 'string') {
    log(`${symbol}: Alpha Vantage error - ${json['Error Message']}`);
    return null;
  }
  if (typeof json?.Note === 'string') {
    log(`${symbol}: Alpha Vantage note - ${json.Note}`);
    return null;
  }
  if (typeof json?.Information === 'string') {
    log(`${symbol}: Alpha Vantage info - ${json.Information}`);
    return null;
  }

  const series = json?.['Time Series (Daily)'];
  if (!series || typeof series !== 'object') {
    const keys = Object.keys(json || {});
    log(`${symbol}: Alpha Vantage returned empty data${keys.length ? ` (keys: ${keys.join(', ')})` : ''}`);
    return null;
  }

  const rows = [];
  for (const [date, item] of Object.entries(series)) {
    if (date < startDate) continue;
    const price = Number(item?.['4. close']);
    if (Number.isFinite(price)) rows.push([date, price]);
  }

  rows.sort((a, b) => a[0].localeCompare(b[0]));
  return rows.length ? rows : null;
}

async function fetchPrices(ticker, startDate, keys) {
  if (alphaVantageTickerSet.has(ticker)) {
    if (!keys.alphaVantage) {
      log(`${ticker}: missing ALPHA_VANTAGE_API_KEY`);
      return null;
    }
    const symbol = alphaVantageSymbolByTicker[ticker] || `${ticker}.TRT`;
    return fetchAlphaVantagePrices(symbol, startDate, keys.alphaVantage);
  }

  if (PRICE_SOURCE === 'fmp') return fetchFmpPrices(ticker, startDate, keys.primary);
  return fetchTiingoPrices(ticker, startDate, keys.primary);
}

async function updateOneTicker(ticker, keys) {
  const filePath = path.join(DATA_DIR, `${ticker}.json`);

  const existingRows = (await readJsonFile(filePath)) || [];
  const map = new Map();
  for (const row of existingRows) {
    if (Array.isArray(row) && typeof row[0] === 'string' && typeof row[1] === 'number') {
      map.set(row[0], row[1]);
    }
  }

  const lastDate = existingRows.length ? existingRows[existingRows.length - 1][0] : null;
  const startDate = lastDate ? subtractDays(lastDate, 7) : '2020-01-01';

  const newRows = await fetchPrices(ticker, startDate, keys);
  if (!newRows) {
    log(`${ticker}: no data (skipping, keeping existing JSON)`);
    return false;
  }

  for (const [date, price] of newRows) {
    map.set(date, price);
  }

  const merged = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  await writePriceHistoryFile(filePath, merged);
  log(`${ticker}: updated (${merged.length} rows)`);
  return true;
}

async function main() {
  const args = parseArgs();
  const todayNY = getTodayDateStrNY();

  const lastMeta = await readJsonFile(META_FILE);
  if (!args.force && lastMeta && lastMeta.dateStr === todayNY) {
    log(`Already updated for ${todayNY} — skipping (use --force to run anyway)`);
    return;
  }

  let key = null;
  if (PRICE_SOURCE === 'fmp') {
    key = getFmpKey();
    if (!key) {
      log('Missing FMP_API_KEY env var. Run: export FMP_API_KEY=your_key');
      process.exitCode = 1;
      return;
    }
  } else {
    key = getTiingoToken();
    if (!key) {
      log('Missing TIINGO_TOKEN env var. Run: export TIINGO_TOKEN=your_token');
      process.exitCode = 1;
      return;
    }
  }
  const alphaVantageKey = getAlphaVantageKey();
  const keys = { primary: key, alphaVantage: alphaVantageKey };

  await fs.mkdir(DATA_DIR, { recursive: true });

  const tickers = await getTickersToUpdate();
  const tickersToUse = args.tickers ? tickers.filter((t) => args.tickers.includes(t)) : tickers;

  if (!tickersToUse.length) {
    log('No tickers found to update.');
    return;
  }

  log(`Updating ${tickersToUse.length} tickers...`);

  let updatedCount = 0;
  for (const ticker of tickersToUse) {
    try {
      const updated = await updateOneTicker(ticker, keys);
      if (updated) updatedCount += 1;
    } catch (e) {
      log(`${ticker}: error (skipping, keeping existing JSON)`);
    }

    const delayMs = alphaVantageTickerSet.has(ticker) ? 13000 : 250;
    await new Promise((r) => setTimeout(r, delayMs));
  }

  await writeJsonFilePretty(META_FILE, {
    dateStr: todayNY,
    updatedTickers: updatedCount,
    attemptedTickers: tickersToUse.length,
  });

  log(`Done. Updated ${updatedCount}/${tickersToUse.length} tickers.`);
}

main();
