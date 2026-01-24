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
            for (const row of data || []) {
                const date = row?.[0];
                const price = row?.[1];
                if (typeof date === 'string' && typeof price === 'number') {
                    AppState.stockPrices[ticker][date] = price;
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

    // if the exact date isn't found, find the closest earlier date
    const dates = Object.keys(AppState.stockPrices[ticker]).sort();
    let closestPrice = 0;
    for (const d of dates) {
        if (d <= dateStr) closestPrice = AppState.stockPrices[ticker][d];
        else break;
    }
    return closestPrice;
}

function getTickersFromTrades(trades) {
    const tickers = new Set();
    for (const trade of trades || []) {
        if (trade?.ticker) tickers.add(trade.ticker);
    }
    return [...tickers].sort();
}
