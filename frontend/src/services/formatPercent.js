// ========================================
// PERCENTAGES THAT DO NOT ROUND TO A FALSE ZERO
// ========================================

// A small positive share such as 0.01% would print as "0.0%" at one decimal,
// which reads as "none". Values too small to show at the given precision
// print as "under 0.1%" (or "under 0.01%", ...). An exact 0 stays "0.0%".
export function formatPercent(value, fractionDigits = 1) {
  const step = 10 ** -fractionDigits;

  if (value > 0 && value < step / 2) {
    return `under ${step.toFixed(fractionDigits)}%`;
  }

  if (value < 0 && value > -step / 2) {
    return `just under ${(0).toFixed(fractionDigits)}%`;
  }

  return `${value.toFixed(fractionDigits)}%`;
}
