function createChart() {
    const netData = dataPoints.map(p => [p.date, p.netWorth]);
    const contribData = dataPoints.map(p => [p.date, p.contribution]);
    
    chart = Highcharts.chart('container', {
        chart: { 
            type: 'line',
            zoomType: 'x',
            animation: false,
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
                color: '#b8b8b8ff',
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
                        setTimeout(resetHeadline, 0);
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
                            updateHeadline(this.index, this.series.name);
                        },
                        mouseOut: function() {
                            resetHeadlineTimeoutId = setTimeout(() => {
                                const chartRef = this.series?.chart;
                                if (!chartRef?.hoverPoint) resetHeadline();
                            }, 0);
                        }
                    }
                }
            }
        },
        series: [
            { name: 'Net worth', data: netData, color: GREEN, lineWidth: 2, zIndex: 2 },
            { name: 'Contributions', data: contribData, color: GOLD, lineWidth: 1.5, zIndex: 1, visible: false }
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

    netSeries = chart.series[0];
    contribSeries = chart.series[1];

    chart.container.addEventListener('mouseleave', resetHeadline);

    resetHeadline();
    initRangeSelector();
    updateRangeButtons('all');
}

function formatNumber(num) {
  return num.toLocaleString('en-CA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}