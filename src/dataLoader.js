async function extractData(path) {
    const data = await fetch(path);
    if (!data.ok) console.error(`Error loading ${path} data.`);
    return data.json();
}

async function loadStockPrices(tickers) {
    const promises = tickers.map(async (ticker) => {
        try {
            const data = await extractData(`data/stockPriceHistory/${ticker}.json`);
            AppState.stockPrices[ticker] = {};
            AppState.stockPriceDatesByTicker[ticker] = [];
            for (const row of data || []) {
                const date = row?.[0];
                const price = row?.[1];
                if (typeof date === 'string' && typeof price === 'number') {
                    AppState.stockPrices[ticker][date] = price;
                    AppState.stockPriceDatesByTicker[ticker].push(date);
                }
            }
        } catch (e) {
            // stock price file doesn't exist for this ticker 
        }
    });
    await Promise.all(promises);
}

function getStockPrice(ticker, dateStr) {
    if (!AppState.stockPrices[ticker]) return 0;
    if (AppState.stockPrices[ticker][dateStr]) return AppState.stockPrices[ticker][dateStr];

    // find closest earlier date via binary search on preloaded sorted date list
    const dates = AppState.stockPriceDatesByTicker[ticker];
    if (!Array.isArray(dates) || !dates.length) return 0;

    let lo = 0;
    let hi = dates.length - 1;
    let bestIdx = -1;

    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const midDate = dates[mid];

        if (midDate <= dateStr) {
            bestIdx = mid;
            lo = mid + 1;
        } else {
            hi = mid - 1;
        }
    }

    if (bestIdx === -1) return 0;
    return AppState.stockPrices[ticker][dates[bestIdx]] ?? 0;
}

function getTickersFromTrades(trades) {
    const tickers = new Set();
    for (const trade of trades || []) {
        if (trade?.ticker) tickers.add(trade.ticker);
    }
    return [...tickers].sort();
}
