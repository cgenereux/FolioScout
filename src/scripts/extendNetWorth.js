import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..', '..');

const DATA_DIR = path.join(ROOT_DIR, 'data');
const STOCK_PRICE_DIR = path.join(DATA_DIR, 'stockPriceHistory');
const NET_WORTH_FILE = path.join(DATA_DIR, 'networth.json');
const CONTRIBUTIONS_FILE = path.join(DATA_DIR, 'contributions.json');
const TRADES_FILE = path.join(DATA_DIR, 'trades.json');

function loadJSON(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
        console.error(`Error loading ${filePath}:`, e.message);
        return null;
    }
}

function saveJSON(filePath, data) {
    const lines = data.map(entry => JSON.stringify(entry));
    const output = '[\n' + lines.join(',\n') + '\n]\n';
    fs.writeFileSync(filePath, output);
}

function loadStockPrices(tickers) {
    const stockPrices = {};
    for (const ticker of tickers) {
        const filePath = path.join(STOCK_PRICE_DIR, `${ticker}.json`);
        const data = loadJSON(filePath);
        if (data) {
            stockPrices[ticker] = {};
            for (const row of data) {
                if (typeof row[0] === 'string' && typeof row[1] === 'number') {
                    stockPrices[ticker][row[0]] = row[1];
                }
            }
        }
    }
    return stockPrices;
}

function getStockPrice(stockPrices, ticker, dateStr) {
    if (!stockPrices[ticker]) return 0;
    if (stockPrices[ticker][dateStr]) return stockPrices[ticker][dateStr];
    const dates = Object.keys(stockPrices[ticker]).sort();
    let closestPrice = 0;
    for (const d of dates) {
        if (d <= dateStr) closestPrice = stockPrices[ticker][d];
        else break;
    }
    return closestPrice;
}

function generateDateRange(startDate, endDate) {
    const dates = [];
    const current = new Date(startDate + 'T00:00:00Z');
    const end = new Date(endDate + 'T00:00:00Z');
    while (current <= end) {
        const yyyy = current.getUTCFullYear();
        const mm = String(current.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(current.getUTCDate()).padStart(2, '0');
        dates.push(`${yyyy}-${mm}-${dd}`);
        current.setUTCDate(current.getUTCDate() + 1);
    }
    return dates;
}

function extendNetWorth() {
    // load existing data
    const netWorthData = loadJSON(NET_WORTH_FILE);
    const contributionsData = loadJSON(CONTRIBUTIONS_FILE);
    const trades = loadJSON(TRADES_FILE);
    const individualContributions = loadJSON(path.join(DATA_DIR, 'individualContributions.json')) || [];

    if (!netWorthData || !contributionsData || !trades) {
        console.error('Missing required data files');
        process.exit(1);
    }

    const lastNwEntry = netWorthData[netWorthData.length - 1];
    const lastContribEntry = contributionsData[contributionsData.length - 1];
    const lastDate = lastNwEntry[0];
    const lastNetWorth = lastNwEntry[1];
    let cumulativeContributions = lastContribEntry[1];

    const today = new Date().toISOString().slice(0, 10);

    if (lastDate >= today) {
        console.log(`Already up to date (last: ${lastDate})`);
        return;
    }

    console.log(`Extending from ${lastDate} to ${today}...`);

    // get tickers and load prices
    const tickers = [...new Set(trades.map(t => t.ticker))].sort();
    const stockPrices = loadStockPrices(tickers);

    // group trades and contributions by date 
    const tradesByDate = {};
    for (const trade of trades) {
        if (!tradesByDate[trade.date]) tradesByDate[trade.date] = [];
        tradesByDate[trade.date].push(trade);
    }

    const contributionsByDate = {};
    for (const [date, amount] of individualContributions) {
        if (!contributionsByDate[date]) contributionsByDate[date] = 0;
        contributionsByDate[date] += amount;
    }

    // build positions (shares) up to lastDate
    const positions = {};
    const sortedTrades = [...trades].sort((a, b) => a.date.localeCompare(b.date));

    for (const trade of sortedTrades) {
        if (trade.date > lastDate) break;

        const price = getStockPrice(stockPrices, trade.ticker, trade.date);
        if (price > 0) {
            const sharesDelta = trade.amount / price;
            if (!positions[trade.ticker]) positions[trade.ticker] = 0;

            if (trade.side === 'BUY') {
                positions[trade.ticker] += sharesDelta;
            } else {
                positions[trade.ticker] = Math.max(0, positions[trade.ticker] - sharesDelta);
            }
        }
    }

    let holdingsValue = 0;
    for (const ticker in positions) {
        if (positions[ticker] > 0.0001) {
            const price = getStockPrice(stockPrices, ticker, lastDate);
            holdingsValue += positions[ticker] * price;
        }
    }

    console.log(`Starting holdings: $${holdingsValue.toFixed(2)}`);

    const newDates = generateDateRange(lastDate, today).slice(1);

    if (newDates.length === 0) {
        console.log('No new dates to add');
        return;
    }

    // process each new date
    for (const dateStr of newDates) {
        // handle contributions for this date
        if (contributionsByDate[dateStr]) {
            cumulativeContributions += contributionsByDate[dateStr];
        }

        // handle trades for this date
        const todaysTrades = tradesByDate[dateStr] || [];
        for (const trade of todaysTrades) {
            const price = getStockPrice(stockPrices, trade.ticker, dateStr);
            if (price > 0) {
                const sharesDelta = trade.amount / price;
                if (!positions[trade.ticker]) positions[trade.ticker] = 0;

                if (trade.side === 'BUY') {
                    positions[trade.ticker] += sharesDelta;
                } else {
                    positions[trade.ticker] = Math.max(0, positions[trade.ticker] - sharesDelta);
                }
            }
        }

        // calculate net worth from current positions
        let stocksValue = 0;
        for (const ticker in positions) {
            if (positions[ticker] > 0.0001) {
                const price = getStockPrice(stockPrices, ticker, dateStr);
                stocksValue += positions[ticker] * price;
            }
        }

        const netWorth = Math.round(stocksValue * 100) / 100;
        const contributions = Math.round(cumulativeContributions * 100) / 100;

        netWorthData.push([dateStr, netWorth]);
        contributionsData.push([dateStr, contributions]);
    }

    // save
    saveJSON(NET_WORTH_FILE, netWorthData);
    saveJSON(CONTRIBUTIONS_FILE, contributionsData);

    const finalEntry = netWorthData[netWorthData.length - 1];
    console.log(`Added ${newDates.length} days`);
    console.log(`Latest: ${finalEntry[0]} = $${finalEntry[1].toLocaleString()}`);
}

extendNetWorth();
