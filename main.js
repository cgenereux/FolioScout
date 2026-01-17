const COLORS = {
    GREEN: '#00c805', 
    RED: '#ff4444', 
    GOLD: '#ffd700',
    CROSSHAIR: '#b8b8b8ff'
};

const UI = {
    headline: document.getElementById('headlineWrap'),
    display: document.getElementById('netWorthDisplay'),
    gain: document.getElementById('gainHeadline'),
    rangeButtons: document.querySelectorAll('#rangeSelector button')
};

let dataPoints = [];
let chart, netWorthSeries;
let lockednetWorthSeriesColor = COLORS.GREEN;
let lastNetWorthSeriesStyleKey = null;
let rangeSelectorInitialized = false;

async function init() {
    await prepareData();
    initRangeSelector();
    createChart();
};

window.addEventListener('DOMContentLoaded', init);

async function prepareData() {
    const netWorthData = await extractData('data/networth.json');
    const contributionData = await extractData('data/contributions.json');
    let lastKnownContribution = 0;
    let currentContribution = 0;

    for (let i = 0; i < netWorthData.length; i++) {
        const dateStr = netWorthData[i][0];
        const utcDateInMS = Date.parse(dateStr);

        if (i < contributionData.length) {
            const contributionEntry = contributionData[i];
            currentContribution = Array.isArray(contributionEntry) ? contributionEntry[1] : contributionEntry;
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

function setNetWorthSeriesZones(splitLocation, firstColor, secondColor) {
    if (!chart || !netWorthSeries) return;

    let zones;
    if (splitLocation == null) {
        // no split point: use one Color for the whole line
        zones = [{ color: secondColor }];
    } else {
        // has a split point: use first Color up to splitLocation, second color after
        zones = [
            { value: splitLocation, color: firstColor }, // color firstColor up to split location 
            { color: secondColor } // then secondColor for the rest
        ];
    }
    let splitPart;
    if (splitLocation == null) {
        splitPart = 'all';
    } else {
        splitPart = splitLocation;
    }
    const styleKey = splitPart + '|' + firstColor + '|' + secondColor;

    if (lastNetWorthSeriesStyleKey === styleKey) return;
    lastNetWorthSeriesStyleKey = styleKey;

    const hoverColor = splitLocation == null ? secondColor : firstColor;

    netWorthSeries.update({
        zoneAxis: 'x',
        zones: zones,
        color: secondColor,
        states: {
            hover: {
                halo: {
                    size: 10,
                    opacity: 0.25,
                    attributes: { fill: hoverColor }
                }
            }
        },
        marker: {
            states: {
                hover: {
                    fillColor: hoverColor,
                    lineColor: hoverColor
                }
            }
        }
    }, false);
    chart.redraw();
}

function setLockednetWorthSeriesColor(color) {
    lockednetWorthSeriesColor = color;
    setNetWorthSeriesZones(null, color, color);
}

function clearNetWorthSeriesSplit() {
    setNetWorthSeriesZones(null, lockednetWorthSeriesColor, lockednetWorthSeriesColor);
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

function updateHeader(hoverIndex, seriesName = 'Net worth') {
    const hoverPoint = dataPoints[hoverIndex];
    if (!hoverPoint) return;

    if (seriesName === 'Contributions') {
        UI.headline.style.color = COLORS.GOLD;
        clearNetWorthSeriesSplit();
        animateDisplay(`$${formatNumber(hoverPoint.contribution)}`);
        UI.gain.textContent = '';
        return;
    }

    // find the start index based on zoom level:
    let startIndex = 0;
    let foundIndex = -1;

    const chartExists = chart && typeof chart.xAxis[0].min === 'number';

    if (chartExists) {
        const minDate = chart.xAxis[0].min;

        for (let i = 0; i < dataPoints.length; i++) {
            if (dataPoints[i].date >= minDate) {
                foundIndex = i;
                break;
            }
        }
        if (foundIndex !== -1 && foundIndex < hoverIndex) startIndex = foundIndex;
    }
    // calculate gain and twrr
    let gain, twrr;
    
    // if the chart is not truncated, we don't need to recompute metrics:
    if (startIndex === 0) {
        gain = hoverPoint.netGain;
        twrr = hoverPoint.TWRR;
    } else {
        const startPoint = dataPoints[startIndex];
        const valChange = hoverPoint.netWorth - startPoint.netWorth;
        const contributionsChange = hoverPoint.contribution - startPoint.contribution;
        
        gain = valChange - contributionsChange;
        twrr = calculateTWRR(startIndex, hoverIndex);
    }

    // apply colors: 
    // go with red if period TWRR is negative; otherwise use green
    const color = twrr < 0 ? COLORS.RED : COLORS.GREEN;
    
    UI.headline.style.color = color;
    if (color === lockednetWorthSeriesColor) {
        clearNetWorthSeriesSplit();
    } else {
        setNetWorthSeriesZones(hoverPoint.date, color, lockednetWorthSeriesColor);
    }

    const gainSign = gain >= 0 ? '+' : '-';
    const twrrSign = twrr >= 0 ? '+' : '';

    animateDisplay(`$${formatNumber(hoverPoint.netWorth)}`);
    UI.gain.textContent = `${gainSign}$${formatNumber(Math.abs(gain))} (${twrrSign}${formatNumber(twrr)}%)`;
}

function resetHeader() {
    if (!chart || !dataPoints.length) return;

    // find the visible Window
    const axis = chart.xAxis[0];
    const ext = axis.getExtremes();
    const minDate = ext.min ?? ext.dataMin;
    const maxDate = ext.max ?? ext.dataMax;

    // find the indices of the Window
    const startIndex = dataPoints.findIndex(p => p.date >= minDate);
    
    // find the end index 
    let endIndex = dataPoints.length - 1;
    for (let i = dataPoints.length - 1; i >= 0; i--) {
        if (dataPoints[i].date <= maxDate) {
            endIndex = i;
            break;
        }
    }
    if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
        updateHeader(dataPoints.length - 1);
        return;
    }

    // calculate locked stats for this View
    const startPoint = dataPoints[startIndex];
    const endPoint = dataPoints[endIndex];

    const valChange = endPoint.netWorth - startPoint.netWorth;
    const contributionsChange = endPoint.contribution - startPoint.contribution;
    const gain = valChange - contributionsChange;
    const twrr = calculateTWRR(startIndex, endIndex);

    // red if period twrr is negative; otherwise green
    const safeTwrr = Number.isFinite(twrr) ? twrr : 0;
    const newColor = safeTwrr < 0 ? COLORS.RED : COLORS.GREEN;

    setLockednetWorthSeriesColor(newColor);

    UI.headline.style.color = newColor;

    const gainSign = gain >= 0 ? '+' : '-';
    const twrrSign = twrr >= 0 ? '+' : '';

    animateDisplay(`$${formatNumber(endPoint.netWorth)}`);
    UI.gain.textContent = `${gainSign}$${formatNumber(Math.abs(gain))} (${twrrSign}${formatNumber(twrr)}%)`;
}

function setRange(range) {
    if (!chart || !dataPoints.length) return;
    const axis = chart.xAxis[0];

    const startMs = getStartDate(range);
    const endMs = dataPoints[dataPoints.length - 1].date;

    if (!startMs) {
        axis.setExtremes(null, null);
    } else {
        axis.setExtremes(startMs, endMs);
    }

    updateRangeButtons(range);
}

function getStartDate(range) {
    if (!dataPoints) return null;
    // find the most up to date point in the dataPoints object array
    const latestTimeStamp = new Date(dataPoints[dataPoints.length-1].date);
    let startRangeTimeStamp = new Date(latestTimeStamp);

    switch (range) {
        case '1d':
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
    if (rangeSelectorInitialized) return;
    rangeSelectorInitialized = true;
    document.getElementById('rangeSelector').addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-range]');
        if (btn) setRange(btn.dataset.range);
    });
}

