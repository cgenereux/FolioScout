const GREEN = getComputedStyle(document.documentElement).getPropertyValue('--green');
const GOLD = getComputedStyle(document.documentElement).getPropertyValue('--gold');
const headlineWrapEl = document.getElementById('headlineWrap');
const displayEl = document.getElementById('myVariableDisplay');
const gainEl = document.getElementById('gainHeadline');

let chart, netSeries, contribSeries, twrrSeriesData;

function formatNumber(num, fractionDigits = 2) {
  const formatted = num.toLocaleString(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  });
  return fractionDigits === 2 ? formatted.replace(/\.00$/, '') : formatted;
}

async function loadJsonData(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error('Failed to fetch ' + path);

  const rawData = await res.json();
  const result = [];

  for (let i = 0; i < rawData.length; i++) {
    const item = rawData[i];

    // if bad data
    if (!Array.isArray(item) || item.length !== 2) {
      console.warn('Invalid data item:', item);
      continue;
    }

    const date = new Date(item[0]);
    // if bad date
    if (isNaN(date.getTime())) {
      console.warn('Invalid date:', item[0]);
      continue;
    }
    result.push([date.getTime(), item[1]]);
  }

  return result;
}

function calculateTwrrSeries(contributions, portfolioValues) {
  const n = portfolioValues.length;
  if (n !== contributions.length) {
    console.error('TWRR: arrays must be same length');
    return Array(n).fill(NaN);
  }
  if (n === 0) return [];

  let twrr = [0];
  let cumulativeReturn = 1.0;

  for (let i = 1; i < n; i++) {
    const startValue = portfolioValues[i - 1];
    const cashFlow = contributions[i] - contributions[i - 1];
    const endValue = portfolioValues[i];
    const base = startValue + cashFlow;

    let periodReturn = 1.0;
    if (base !== 0) {
      periodReturn = endValue / base;
    }
    if (!isFinite(periodReturn)) {
      periodReturn = 1.0;
    }

    cumulativeReturn *= periodReturn;
    twrr.push((cumulativeReturn - 1) * 100);
  }
  return twrr;
}

function updateHeadline(netWorthVal, contribVal, pointIndex) {
  const netVisible = netSeries?.visible;
  const contribVisible = contribSeries?.visible;

  if (contribVisible && !netVisible) {
    headlineWrapEl.style.color = GOLD;
    displayEl.textContent = `$${formatNumber(contribVal)}`;
    gainEl.textContent = '';
    return;
  }

  headlineWrapEl.style.color = GREEN;
  const gain = netWorthVal - contribVal;

  let twrr = 0;
  if (twrrSeriesData && pointIndex >= 0 && pointIndex < twrrSeriesData.length) {
    twrr = twrrSeriesData[pointIndex];
  } else if (twrrSeriesData?.length > 0) {
    twrr = twrrSeriesData.at(-1);
  }
  if (isNaN(twrr)) twrr = 0;

  const twrrSign = twrr > 0 ? '+' : '';
  displayEl.textContent = `$${formatNumber(netWorthVal)}`;
  gainEl.textContent = `${gain >= 0 ? '+' : '-'}$${formatNumber(Math.abs(gain))} (${twrrSign}${formatNumber(twrr, 2)}%)`;
}

function alignSeries(netWorthSeries, contributionSeries) {
  // turn these arrays into maps for fast lookups
  const netWorthByTime = new Map(netWorthSeries);
  const contribByTime = new Map(contributionSeries);

  // collect every timestamp that appears in each series and then sort
  const timestamps = Array.from(
    new Set([
      ...netWorthSeries.map(([timestamp]) => timestamp),
      ...contributionSeries.map(([timestamp]) => timestamp)
    ])
  ).sort((a, b) => a - b);

  const alignedNetWorth = [];
  const alignedContrib = [];
  const netWorthValues = [];
  const contribValues = [];

  let lastNetWorth = 0;
  let lastContrib = 0;

  for (const timestamp of timestamps) {
    if (netWorthByTime.has(timestamp)) lastNetWorth = netWorthByTime.get(timestamp);
    if (contribByTime.has(timestamp)) lastContrib = contribByTime.get(timestamp);

    alignedNetWorth.push([timestamp, lastNetWorth]);
    alignedContrib.push([timestamp, lastContrib]);

    netWorthValues.push(lastNetWorth);
    contribValues.push(lastContrib);
  }

  return {
    alignedNetWorth,  
    alignedContrib, 
    netWorthValues, // for twrr 
    contribValues // for twrrr
  };
}


function padContribSeries() {
  if (!netSeries?.points || !contribSeries?.points) return;

  const netLen = netSeries.points.length;
  const contribLen = contribSeries.points.length;

  if (netLen > contribLen) {
    let lastContribution = 0;
    if (contribLen > 0) {
      lastContribution = contribSeries.points[contribLen - 1].y;
    }
    for (let i = contribLen; i < netLen; i++) {
      // series.addPoint(point, redraw, shift, animation) : no redraw, shift, or animation 
      contribSeries.addPoint([netSeries.points[i].x, lastContribution], false, false, false);
    }
  }
}

function createChart(netData, contribData) {
  Highcharts.setOptions({
    lang: { thousandsSep: ',' }
  });

  chart = Highcharts.chart('container', {
    chart: {
      type: 'line',
      zoomType: 'x',
      animation: false
    },
    title: { text: '' },
    xAxis: {
      type: 'datetime',
      dateTimeLabelFormats: { day: '%e %b %Y' },
      labels: { style: { color: '#999' } },
      lineColor: '#999'
    },
    yAxis: {
      gridLineWidth: 0,
      labels: { style: { color: '#999' } },
      lineColor: '#999',
      title: { text: null }
    },
    tooltip: {
      shared: true,
      useHTML: true,
      formatter: function () {
        var points = this.points;
        var date = Highcharts.dateFormat('%e %b %Y', points[0].x);

        var rows = '';
        for (var i = 0; i < points.length; i++) {
          var p = points[i];
          var label = p.series.name === 'Net worth' ? 'Net Worth:' : 'Contributions:';
          rows += label + '<br>';
          rows += '<span style="color:' + p.series.color + ';font-weight:bold">';
          rows += '$' + formatNumber(p.y) + '</span><br>';
        }

        return '<div style="text-align:center;font-weight:600">' + rows + date + '</div>';
      }
    },
    legend: {
      layout: 'vertical',
      align: 'right',
      verticalAlign: 'middle'
    },
    plotOptions: {
      series: {
        animation: false,
        marker: {
          enabled: false,
          states: { hover: { radius: 4.5 } }
        },
        states: {
          hover: { lineWidthPlus: 0 },
          inactive: { opacity: 0.4, animation: false }
        },
        events: {
          legendItemClick: function () {
            setTimeout(function () {
              if (!netSeries || !netSeries.points || netSeries.points.length === 0) {
                return;
              }

              var lastIndex = netSeries.points.length - 1;
              var lastNet = netSeries.points[lastIndex];
              var lastContrib = contribSeries && contribSeries.points[lastIndex]
                ? contribSeries.points[lastIndex]
                : { y: 0 };

              var firstValue = netSeries.visible ? lastNet.y : lastContrib.y;
              var secondValue = contribSeries.visible ? lastContrib.y : lastNet.y;

              updateHeadline(firstValue, secondValue, lastIndex);
            }, 0);
            return true;
          }
        },
        point: {
          events: {
            mouseOver: function () {
              var hoveredPoint = this;
              var idx = hoveredPoint.index;
              var chartRef = hoveredPoint.series.chart;

              var netPoint = chartRef.series[0].data[idx];
              var contribPoint = chartRef.series[1].data[idx];
              if (!netPoint || !contribPoint) {
                return;
              }

              // find the other series 
              var otherSeries = chartRef.series[0] === hoveredPoint.series
                ? chartRef.series[1]
                : chartRef.series[0];
              var otherPoint = otherSeries.data[idx];

              hoveredPoint.setState('hover');
              if (otherPoint) {
                otherPoint.setState('hover');
              }

              updateHeadline(netPoint.y, contribPoint.y, idx);

              if (otherPoint) {
                chartRef.tooltip.refresh([hoveredPoint, otherPoint]);
              } else {
                chartRef.tooltip.refresh([hoveredPoint]);
              }
            },
            mouseOut: function () {
              var hoveredPoint = this;
              var chartRef = hoveredPoint.series.chart;

              hoveredPoint.setState();

              var otherSeries = chartRef.series[0] === hoveredPoint.series
                ? chartRef.series[1]
                : chartRef.series[0];
              var otherPoint = otherSeries.data[hoveredPoint.index];
              if (otherPoint) {
                otherPoint.setState();
              }

              chartRef.tooltip.hide();
              resetHeadlineToLatest();
            }
          }
        }
      }
    },
    series: [
      {
        name: 'Net worth',
        data: netData,
        color: GREEN,
        lineWidth: 2,
        zIndex: 2
      },
      {
        name: 'Contributions',
        data: contribData,
        color: GOLD,
        lineWidth: 1.5,
        zIndex: 1,
        visible: false
      }
    ],
    responsive: {
      rules: [{
        condition: { maxWidth: 500 },
        chartOptions: {
          legend: {
            layout: 'horizontal',
            align: 'center',
            verticalAlign: 'bottom'
          }
        }
      }]
    }
  });

  netSeries = chart.series[0];
  contribSeries = chart.series[1];
  padContribSeries();

  resetHeadlineToLatest();

  chart.container.addEventListener('mouseleave', function () {
    resetHeadlineToLatest();
  });
}

function resetHeadlineToLatest() {
  if (!netSeries || !netSeries.points || netSeries.points.length === 0) {
    updateHeadline(0, 0, 0);
    return;
  }

  var lastIndex = netSeries.points.length - 1;
  var lastNet = netSeries.points[lastIndex];

  var lastContrib;
  if (contribSeries && contribSeries.points && contribSeries.points[lastIndex]) {
    lastContrib = contribSeries.points[lastIndex];
  } else {
    lastContrib = { y: lastNet.y };
  }

  updateHeadline(lastNet.y, lastContrib.y, lastIndex);
}

(async () => {
  try {
    const rawNetWorth = await loadJsonData('data/networth.json');
    const rawContrib = await loadJsonData('data/contributions.json');

    if (rawNetWorth.length === 0) {
      displayEl.textContent = 'No net worth data';
      gainEl.textContent = '';
      return;
    }

    const aligned = alignSeries(rawNetWorth, rawContrib);

    if (aligned.netWorthValues.length > 0) {
      twrrSeriesData = calculateTwrrSeries(aligned.contribValues, aligned.netWorthValues);
    } else {
      twrrSeriesData = [];
    }

    createChart(aligned.alignedNetWorth, aligned.alignedContrib);

  } catch (e) {
    console.error('Start error:', e);
    displayEl.textContent = 'Data load failed';
    gainEl.textContent = '';
  }
})();
