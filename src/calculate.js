function createEmptyPosition() {
    return { shares: 0, costBasis: 0, realizedCost: 0, realizedProceeds: 0 };
}

function processTrade(position, trade, price) {
    if (!(price > 0)) return position;

    const pos = position || createEmptyPosition();
    const sharesDelta = trade.amount / price;

    if (trade.side === 'BUY') {
        pos.shares += sharesDelta;
        pos.costBasis += trade.amount;
    } else {
        const sharesBefore = pos.shares;
        if (sharesBefore > 0) {
            const costPerShare = pos.costBasis / sharesBefore;
            const sharesSold = Math.min(sharesDelta, sharesBefore);
            const proceeds = sharesDelta > 0 ? trade.amount * (sharesSold / sharesDelta) : 0;
            const soldCost = costPerShare * sharesSold;

            pos.shares -= sharesSold;
            pos.costBasis -= soldCost;
            pos.realizedCost += soldCost;
            pos.realizedProceeds += proceeds;
        }
    }

    return pos;
}

function calculatePeriodReturn(prevPoint, currPoint) {
    const cashFlow = (currPoint.contribution ?? 0) - (prevPoint.contribution ?? 0);
    const base = prevPoint.netWorth + cashFlow;
    if (base === 0) return 1;
    const ratio = currPoint.netWorth / base;
    return isFinite(ratio) ? ratio : 1;
}

function calculateTWRR(startIndex, endIndex) {
    let cumulativeGrowth = 1;
    for (let i = startIndex + 1; i <= endIndex; i++) {
        cumulativeGrowth *= calculatePeriodReturn(
            AppState.dataPoints[i - 1],
            AppState.dataPoints[i]
        );
    }
    return (cumulativeGrowth - 1) * 100;
}

function calculateAvgShareReturnPercent(position, currentPrice) {
    if (!position) return null;
    if (!(position.shares > 0)) return null;
    if (!(position.costBasis > 0)) return null;
    if (!(currentPrice > 0)) return null;

    const averageCost = position.costBasis / position.shares;
    if (!(averageCost > 0)) return null;

    return ((currentPrice - averageCost) / averageCost) * 100;
}

function calculateTotalReturnPercent(position, currentPrice) {
    if (!position) return null;

    const shares = position.shares || 0;
    const costBasis = position.costBasis || 0;
    const realizedCost = position.realizedCost || 0;
    const realizedProceeds = position.realizedProceeds || 0;

    const totalCost = realizedCost + costBasis;
    if (!(totalCost > 0)) return null;

    const hasShares = shares > 0.000001;
    const currentValue = hasShares ? shares * currentPrice : 0;
    if (hasShares && !(currentPrice > 0)) return null;

    const totalProceeds = realizedProceeds + currentValue;
    return ((totalProceeds - totalCost) / totalCost) * 100;
}
