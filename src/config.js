const wealthsimpleTradeDataSrc = 'activities_export';

const blackBoxLogos = ['ASML', 'PLTR', 'AMZN', 'SOXL', 'TQQQ', 'CURE', 'INTC', 'TMF', 'UBER', 'TSLL'];

const useAlphaVantageTickers = ['NA', 'XBAL', 'VFV', 'QQU', 'HUG', 'XEQT'];

const alphaVantageSymbolByTicker = {
  NA: 'NA.TRT',
  XBAL: 'XBAL.TRT',
  VFV: 'VFV.TRT',
  QQU: 'QQU.TRT',
  HUG: 'HUG.TRT',
  XEQT: 'XEQT.TRT',
};

globalThis.FolioScoutConfig = {
  wealthsimpleTradeDataSrc,
  blackBoxLogos,
  useAlphaVantageTickers,
  alphaVantageSymbolByTicker,
};

// Keep existing browser globals intact for older non-module scripts.
globalThis.blackBoxLogos = blackBoxLogos;
