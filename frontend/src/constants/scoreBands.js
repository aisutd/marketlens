// Opportunity score bands. The odds come from the holdout table in
// product_success/README.md: how often products in each band really reached
// the top 20% of sales in their category.

// Used as text on paper and card surfaces, so each holds at least 4.5:1 there
// (green 5.5, amber 5.9, red 5.9 on --card). Green and red sit on the
// --signal-up / --signal-down hues; the old Tailwind green was 3.2:1 and
// off-palette.
const GREEN = "oklch(0.5 0.105 162)";
const AMBER = "oklch(0.5 0.12 75)";
const RED = "oklch(0.52 0.19 30)";

const BANDS = [
  {
    min: 90,
    label: "Top pick",
    color: GREEN,
    odds: "About 1 in 2 products scoring this high reach top-20% sales in their category (average is 1 in 5)",
  },
  {
    min: 80,
    label: "Strong",
    color: GREEN,
    odds: "About 1 in 3 products scoring this high reach top-20% sales in their category (average is 1 in 5)",
  },
  {
    min: 40,
    label: "Average",
    color: AMBER,
    odds: "About 1 in 5 products in this range reach top-20% sales in their category, the same as the average product.",
  },
  {
    min: 0,
    label: "Weak",
    color: RED,
    odds: "Fewer than 1 in 10 products scoring this low reach top-20% sales in their category (average is 1 in 5)",
  },
];

const NOT_SCORED = {
  label: "Not scored",
  color: "oklch(0.47 0.02 60)",
  odds: null,
};

export function getScoreBand(score) {
  if (typeof score !== "number" || !Number.isFinite(score)) {
    return NOT_SCORED;
  }

  return BANDS.find((band) => score >= band.min) ?? BANDS.at(-1);
}
