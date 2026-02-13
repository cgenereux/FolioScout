const COLORS = {
    GREEN: '#00c805',
    RED: '#ff4444',
    GOLD: '#ffd700',
    CROSSHAIR: '#b8b8b8ff'
};

const UI = {
    headline: null,
    display: null,
    gain: null,
    rangeButtons: null,
    backButton: null,
    holdingsPanel: null
};

const AppState = {
    // chart data
    dataPoints: [],
    portfolioDataPoints: [],

    // highcharts references
    chart: null,
    netWorthSeries: null,

    // chart styling state
    lockednetWorthSeriesColor: COLORS.GREEN,
    lastNetWorthSeriesStyleKey: null,
    rangeSelectorInitialized: false,

    // view state: portfolio or specific ticker
    currentView: 'portfolio',

    // stock price histories
    stockPrices: {},
    stockPriceDatesByTicker: {},

    // holding logo paths 
    logosByTicker: {},

    // latest return % per ticker 
    latestReturnPercentByTicker: {},

    // tickers derived from trades.json
    portfolioTickers: [],

    // dateStr -> portfolio index (for syncing stock view hover to portfolio metrics)
    portfolioIndexByDateStr: {},

    // quick lookup for updating weights in the holdings panel
    holdingWeightElByTicker: {},
    holdingValueElByTicker: {},
    holdingReturnElByTicker: {},
    holdingsPanelDelegationInitialized: false
};

function initUI() {
    UI.headline = document.getElementById('headlineWrap');
    UI.display = document.getElementById('netWorthDisplay');
    UI.gain = document.getElementById('gainHeadline');
    UI.rangeButtons = document.querySelectorAll('#rangeSelector button');
    UI.backButton = document.getElementById('backToPortfolio');
    UI.holdingsPanel = document.getElementById('holdingsPanel');
}
