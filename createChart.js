function createChart() {
    const netData = dataPoints.map(p => [p.date, p.netWorth]);
    const contributionsData = dataPoints.map(p => [p.date, p.contribution]);
    
    chart = Highcharts.chart('container', {
        chart: { 
            type: 'line',
            zoomType: 'x',
            animation: false,
            events: {
                selection: function (event) {
                    if (event?.resetSelection) {
                        setTimeout(resetHeader, 0);
                        return true;
                    }
                    if (event?.xAxis?.[0]) {
                        calculateAndShowZoomStats(event.xAxis[0].min, event.xAxis[0].max);
                    }
                    return true;
                }
            },
            resetZoomButton: {
                theme: {
                    fill: '#ffffff', 
                    r: 12,   // round corners
                    width: 70, 
                    height: 10,
                    stroke: '#cccccc', // border
                    strokeWidth: 1,
                    style: {
                        lineHeight: '40px', 
                    }
                }
            },
        },
        title: { text: '' },
        credits: { enabled: false },
        xAxis: {
            type: 'datetime',
            minRange: 1,
            tickAmount: 5,
            labels: { 
                style: { color: '#999' },
            },
            events: {
                afterSetExtremes: function () {
                    setTimeout(() => {
                        if (!this?.chart?.hoverPoint) resetHeader();
                    }, 0);
                }
            },
            dateTimeLabelFormats: {
                month: '%b \'%y',
                year: '%Y'       
            },
            units: [
                ['month', [1, 3, 6]],
                ['year', [1]]
            ],
            lineColor: '#999',
            crosshair: {
                width: 1.5,
                color: COLORS.CROSSHAIR,
                label: {
                    enabled: true,
                    backgroundColor: '#525252ff',
                    style: {
                        color: 'white',
                        fontWeight: 'bold'
                    },
                    formatter: function (value) {
                        return Highcharts.dateFormat('%b %d, %Y', value);
                    }
                },
            }
        },
        yAxis: {
            gridLineWidth: 0,
            labels: { style: { color: '#999' } },
            lineColor: '#999',
            title: { text: null }
        },
        legend: { layout: 'horizontal', align: 'right', verticalAlign: 'top' },
        tooltip: {
            enabled: false
        },
        plotOptions: {
            series: {
                animation: false,
                marker: {
                    enabled: false,
                    states: { hover: { enabled: true, radius: 4 } }
                },
                states: {
                    hover: { lineWidthPlus: 0 },
                    inactive: { opacity: 0.4 }
                },
                events: {
                    legendItemClick: function() {
                        setTimeout(resetHeader, 0);
                        return true;
                    }
                },
                point: {
                    events: {
                        mouseOver: function() {
                            if (resetHeadlineTimeoutId) {
                                clearTimeout(resetHeadlineTimeoutId);
                                resetHeadlineTimeoutId = null;
                            }
                            updateHeader(this.index, this.series.name);
                        },
                        mouseOut: function() {
                            resetHeadlineTimeoutId = setTimeout(() => {
                                const chartRef = this.series?.chart;
                                if (!chartRef?.hoverPoint) resetHeader();
                            }, 0);
                        }
                    }
                }
            }
        },
        series: [
            { name: 'Net worth', data: netData, color: COLORS.GREEN, lineWidth: 2, zIndex: 2 },
            { name: 'Contributions', data: contributionsData, color: COLORS.GOLD, lineWidth: 1.5, zIndex: 1, visible: false }
        ],
        responsive: {
            rules: [{
                condition: { maxWidth: 500 },
                chartOptions: {
                    legend: { align: 'center', verticalAlign: 'bottom' }
                }
            }]
        }
    });

    netWorthSeries = chart.series[0];

    chart.container.addEventListener('mouseleave', resetHeader);

    resetHeader();
    initRangeSelector();
    updateRangeButtons('all');
}

function formatNumber(num) {
  return num.toLocaleString('en-CA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function calculateAndShowZoomStats(minDate, maxDate) {
    let startIndex = dataPoints.findIndex(p => p.date >= minDate);
    let endIndex = -1;
    
    for(let i = dataPoints.length - 1; i >= 0; i--) {
        if (dataPoints[i].date <= maxDate) {
            endIndex = i;
            break;
        }
    }

    if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) return;
 
    const startPoint = dataPoints[startIndex];
    const endPoint = dataPoints[endIndex];

    const rangeTWRR = calculateTWRR(startIndex, endIndex);

    const valChange = endPoint.netWorth - startPoint.netWorth;
    const contributionsChange = endPoint.contribution - startPoint.contribution;
    const rangeGain = valChange - contributionsChange;

    const gainSign = rangeGain >= 0 ? '+' : '-';
    const twrrSign = rangeTWRR >= 0 ? '+' : '';
    const safeTwrr = Number.isFinite(rangeTWRR) ? rangeTWRR : 0;
    const color = safeTwrr < 0 ? COLORS.RED : COLORS.GREEN;

    UI.headline.style.color = color; 
    setLockednetWorthSeriesColor(color);
    
    animateDisplay(`$${formatNumber(endPoint.netWorth)}`);
    UI.gain.textContent = `${gainSign}$${formatNumber(Math.abs(rangeGain))} (${twrrSign}${rangeTWRR.toFixed(2)}%)`;
}
