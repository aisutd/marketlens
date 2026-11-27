// Shared number and money formatting (#50). Pages used to carry their own
// copies of these, and the copies drifted (#41's rounding difference came
// from two moneyFormatters). Each page now picks a format and a parser
// here, so the choice is visible in one line and fixed in one place.

// Shown when there is no number to format.
export const MISSING = "—";

// Whole numbers with thousands separators: 5,200.
export const numberFormat = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

// Dollars and cents: $24.99, $129,948.00.
export const moneyFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// Whole dollars, for large totals: $5,400.
export const wholeMoneyFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

// Short form for chart axes: 5.2K, 1.3M.
export const compactFormat = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

// A finite number from an API value (number or numeric string), or null.
// Pages that format text typed into a field use parseNumberInput
// (lib/numberInput.js) instead, which rejects blank text and exponents.
export function toNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    !Number.isFinite(Number(value))
  ) {
    return null;
  }

  return Number(value);
}

// A formatting function: parse the value, then format it, or MISSING.
export function formatWith(format, parse = toNumber) {
  return (value) => {
    const number = parse(value);
    return number === null ? MISSING : format.format(number);
  };
}
