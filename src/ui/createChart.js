let _pendingZoneUpdate = null;
let _zoneRafId = null;

function setNetWorthSeriesZones(splitLocation, firstColor, secondColor) {
    if (!AppState.chart || !AppState.netWorthSeries) return;

    const splitPart = splitLocation == null ? 'all' : splitLocation;
    const styleKey = splitPart + '|' + firstColor + '|' + secondColor;

    if (AppState.lastNetWorthSeriesStyleKey === styleKey) return;
    AppState.lastNetWorthSeriesStyleKey = styleKey;

    _pendingZoneUpdate = { splitLocation, firstColor, secondColor };

    if (!_zoneRafId) {
        _zoneRafId = requestAnimationFrame(flushZoneUpdate);
    }
}

function flushZoneUpdate() {
    _zoneRafId = null;
    const pending = _pendingZoneUpdate;
    if (!pending || !AppState.chart || !AppState.netWorthSeries) return;
    _pendingZoneUpdate = null;

    const { splitLocation, firstColor, secondColor } = pending;

    let zones;
    if (splitLocation == null) {
        zones = [{ color: secondColor }];
    } else {
        zones = [
            { value: splitLocation, color: firstColor },
            { color: secondColor }
        ];
    }

    const hoverColor = splitLocation == null ? secondColor : firstColor;

    AppState.netWorthSeries.update({
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
    AppState.chart.redraw(false);
}

function setLockednetWorthSeriesColor(color) {
    AppState.lockednetWorthSeriesColor = color;
    setNetWorthSeriesZones(null, color, color);
}

function clearNetWorthSeriesSplit() {
    setNetWorthSeriesZones(null, AppState.lockednetWorthSeriesColor, AppState.lockednetWorthSeriesColor);
}

function createChart() {
    const netData = AppState.dataPoints.map(point => [point.date, point.netWorth]);
    const contributionsData = AppState.dataPoints.map(point => [point.date, point.contribution]);

    const isStock = AppState.currentView !== 'portfolio';
    const mainSeriesName = isStock ? AppState.currentView : 'Net worth';

    AppState.chart = Highcharts.chart('container', {
        chart: {
            type: 'line',
            zooming: {
                type: 'x',
                mouseWheel: { enabled: false }
            },
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
                position: {
                    align: 'right',
                    verticalAlign: 'top',
                    x: 6,
                    y: -8
                },
                theme: {
                    fill: '#ffffff',
                    r: 12,
                    width: 70,
                    height: 10,
                    stroke: '#cccccc',
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
                animation: true,
                animation: {
                    duration: 860
                },
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
                            if (AppState.currentView !== 'portfolio' && typeof window.updateSelectedHoldingMetricsByDateStr === 'function') {
                                const dateStr = AppState.dataPoints[this.index]?.dateStr;
                                window.updateSelectedHoldingMetricsByDateStr(dateStr);
                            }
                        },
                        mouseOut: function() {
                            resetHeadlineTimeoutId = setTimeout(() => {
                                const chartRef = this.series?.chart;
                                if (!chartRef?.hoverPoint) {
                                    resetHeader();
                                    if (AppState.currentView !== 'portfolio' && typeof window.resetSelectedHoldingMetricsToLatest === 'function') {
                                        window.resetSelectedHoldingMetricsToLatest();
                                    }
                                }
                            }, 0);
                        }
                    }
                }
            }
        },
        series: isStock
            ? [{ name: mainSeriesName, data: netData, color: COLORS.GREEN, lineWidth: 2, zIndex: 2 }]
            : [
                { name: mainSeriesName, data: netData, color: COLORS.GREEN, lineWidth: 2, zIndex: 2 },
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

    AppState.netWorthSeries = AppState.chart.series[0];

    AppState.chart.container.addEventListener('mouseleave', resetHeader);
    AppState.chart.container.addEventListener('mouseleave', () => {
        if (AppState.currentView !== 'portfolio' && typeof window.resetSelectedHoldingMetricsToLatest === 'function') {
            window.resetSelectedHoldingMetricsToLatest();
        }
    });

    resetHeader();
    initRangeSelector();
    updateRangeButtons('all');
}

function initHoldingsPanelPlotSync(chartRef) {
    const holdingsPanel = document.getElementById('holdingsPanel');
    if (!holdingsPanel || !chartRef) return;

    let lastTop = null;
    let lastHeight = null;

    const update = () => {
        const plotTop = Math.max(0, Math.round(chartRef.plotTop || 0));
        const plotHeight = Math.max(0, Math.round(chartRef.plotHeight || 0));

        if (plotTop === lastTop && plotHeight === lastHeight) return;
        lastTop = plotTop;
        lastHeight = plotHeight;

        holdingsPanel.style.setProperty('--chart-plot-top', `${plotTop}px`);
        holdingsPanel.style.setProperty('--chart-plot-height', `${plotHeight}px`);

        document.documentElement.style.setProperty('--chart-plot-top', `${plotTop}px`);
        document.documentElement.style.setProperty('--chart-plot-height', `${plotHeight}px`);
    };

    update();

    if (typeof ResizeObserver === 'undefined') {
        window.addEventListener('resize', () => requestAnimationFrame(update), { passive: true });
        return;
    }

    const observer = new ResizeObserver(() => requestAnimationFrame(update));
    observer.observe(chartRef.renderTo);
}

function calculateAndShowZoomStats(minDate, maxDate) {
    let startIndex = AppState.dataPoints.findIndex(p => p.date >= minDate);
    let endIndex = -1;

    for(let i = AppState.dataPoints.length - 1; i >= 0; i--) {
        if (AppState.dataPoints[i].date <= maxDate) {
            endIndex = i;
            break;
        }
    }

    if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) return;

    const startPoint = AppState.dataPoints[startIndex];
    const endPoint = AppState.dataPoints[endIndex];

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

