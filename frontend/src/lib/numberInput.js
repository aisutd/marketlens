// Number fields are plain text inputs with an inputMode, not
// type="number": a number input changes its value when the page is
// scrolled over it while focused. A text input accepts anything, so this
// parser is the gate that type="number" used to be.

// A plain non-negative decimal: "12", "12.", "12.5", ".5". Surrounding
// spaces are ignored. Signs, exponents, hex, commas and currency symbols
// are not accepted, so "  " is not 0 and "1e3" is not 1000.
const DECIMAL = /^(?:\d+\.?\d*|\.\d+)$/;

// The number a field's text stands for, or null when it is empty or not
// a plain decimal. Numbers (already parsed values) pass through when
// finite, so callers can use one helper for state and API data alike.
export function parseNumberInput(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== "string") return null;

  const text = value.trim();
  if (!DECIMAL.test(text)) return null;

  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

// True when the field is empty, only spaces, null or undefined.
export function isBlank(value) {
  if (value === null || value === undefined) return true;
  return typeof value === "string" && value.trim() === "";
}
