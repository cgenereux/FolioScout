function formatNumber(num) {
    return num.toLocaleString('en-CA', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatCurrency(amount) {
    const n = Number(amount);
    if (!Number.isFinite(n)) return '$0.00';
    if (n !== 0 && Math.abs(n) < 0.01) return '<$0.01';
    return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatWeightPercent(percent) {
    const n = Number(percent);
    if (!Number.isFinite(n)) return '0.0%';
    if (n !== 0 && n < 0.1) return '<0.1%';
    return formatNumber(n) + '%';
}

function formatReturnPercent(percent) {
    const n = Number(percent);
    if (!Number.isFinite(n)) return '';
    if (n === 0) return '0.00%';

    const sign = n > 0 ? '+' : '';
    if (Math.abs(n) < 0.01) return `${sign}<0.01%`;
    return `${sign}${formatNumber(n)}%`;
}
