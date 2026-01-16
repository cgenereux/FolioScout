const GREEN = getComputedStyle(document.documentElement).getPropertyValue('--green');
const GOLD = getComputedStyle(document.documentElement).getPropertyValue('--gold');
const headlineWrapEl = document.getElementById('headlineWrap');
const displayEl = document.getElementById('myVariableDisplay');
const gainEl = document.getElementById('gainHeadline');

let dataPoints = [];
let chart, netSeries, contribSeries;

async function init() {
    await prepareData();
    createChart();
    } 
init();

async function prepareData() {
    const netWorthData = await extractData('data/networth.json');
    const contributionData = await extractData('data/contributions.json');

    // build a map for fast date-based lookup since arrays may be out of sync
    const contribByDate = new Map(contributionData.map(([date, val]) => [date, val]));

    let lastKnownContribution = 0;

    for (let i = 0; i < netWorthData.length; i++) {
        const dateStr = netWorthData[i][0];
        const utcDateInMS = Date.parse(dateStr);

        // lookup contribution by date, fall back to last known
        let currentContribution;
        if (contribByDate.has(dateStr)) {
            currentContribution = contribByDate.get(dateStr);
            lastKnownContribution = currentContribution;
        } else {
            currentContribution = lastKnownContribution;
        }

        const currentNetGain = netWorthData[i][1] - currentContribution;

        dataPoints.push({
            netWorth: netWorthData[i][1],
            contribution: currentContribution,
            TWRR: null,
            netGain: currentNetGain,
            index: i,
            date: utcDateInMS
        });
        dataPoints[i].TWRR = calculateTWRR(0, i);
    }
}

async function extractData(path) {
    const data = await fetch(path);
    if (!data.ok) console.error(`Error loading ${path} data.`);
    return data.json();
};

function calculateTWRR(startIndex, endIndex) {
    let cumulativeGrowth = 1;

    for (let i = startIndex + 1; i <= endIndex; i++) {
        const prevPoint = dataPoints[i - 1];
        const currPoint = dataPoints[i];

        const prevContrib = prevPoint.contribution ?? 0;
        const currContrib = currPoint.contribution ?? 0;
        const cashFlow = currContrib - prevContrib;
        const base = prevPoint.netWorth + cashFlow;

        let periodReturn = 1;
        if (base !== 0) {
            periodReturn = currPoint.netWorth / base;
        }
        if (!isFinite(periodReturn)) {
            periodReturn = 1;
        }
        cumulativeGrowth *= periodReturn;
    }
    return (cumulativeGrowth - 1) * 100;
}

function updateHeadline(index, seriesName = 'Net worth') {
    const point = dataPoints[index];
    if (!point) return;

    // show contributions style when hovering on contributions line
    if (seriesName === 'Contributions') {
        headlineWrapEl.style.color = GOLD;
        animateDisplay(`$${formatNumber(point.contribution)}`);
        gainEl.textContent = '';
        return;
    }

    headlineWrapEl.style.color = GREEN;
    const gain = point.netGain;
    const twrr = point.TWRR ?? 0;

    const gainSign = gain >= 0 ? '+' : '-';
    const twrrSign = twrr >= 0 ? '+' : '';

    animateDisplay(`$${formatNumber(point.netWorth)}`);
    gainEl.textContent = `${gainSign}$${formatNumber(Math.abs(gain))} (${twrrSign}${twrr.toFixed(2)}%)`;
}

function resetHeadline() {
    updateHeadline(dataPoints.length - 1);
}

function setRange(range) {
    if (!chart || !dataPoints.length) return; 
    const axis = chart.xAxis[0];

    const startMs = getStartDate(range);
    const endMs = dataPoints[dataPoints.length - 1].date;

    if (!startMs ) { axis.setExtremes(null, null);
    } else { axis.setExtremes(startMs, endMs); }

    updateRangeButtons(range);
    resetHeadline();
    
}

function getStartDate(range) {
    if (!dataPoints) return null;
    // find the most up to date point in the dataPoints object array
    const latestTimeStamp = new Date(dataPoints[dataPoints.length-1].date);
    let startRangeTimeStamp = new Date(latestTimeStamp);

    switch (range) {
        case '1d':
            // show last 2 data points
            if (dataPoints.length >= 2) {
                return dataPoints[dataPoints.length - 2].date;
            }
            return null;
        case '1w':
            startRangeTimeStamp.setUTCDate(startRangeTimeStamp.getUTCDate() - 7);
            break;
        case '1m':
            startRangeTimeStamp.setUTCMonth(startRangeTimeStamp.getUTCMonth() - 1);
            break;
        case '3m':
            startRangeTimeStamp.setUTCMonth(startRangeTimeStamp.getUTCMonth() - 3);
            break;
        case '1y':
            startRangeTimeStamp.setUTCFullYear(startRangeTimeStamp.getUTCFullYear() - 1);
            break;
        case '2y':
            startRangeTimeStamp.setUTCFullYear(startRangeTimeStamp.getUTCFullYear() - 2);
            break;
        case '3y':
            startRangeTimeStamp.setUTCFullYear(startRangeTimeStamp.getUTCFullYear() - 3);
            break;
        case 'all':
            return null;
        default:
            return null;
    }
    return startRangeTimeStamp.getTime();
}

function updateRangeButtons(activeRange) {
    const buttons = document.querySelectorAll('#rangeSelector button');
    
    for (let i = 0; i < buttons.length; i++) {
        const btn = buttons[i];
        const btnRange = btn.dataset.range;
        
        if (btnRange === activeRange) {
            btn.classList.add('is-active');
        } else {
            btn.classList.remove('is-active');
        }
    }
}

function initRangeSelector() {
    document.getElementById('rangeSelector').addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-range]');
        if (btn) setRange(btn.dataset.range);
    });
}
