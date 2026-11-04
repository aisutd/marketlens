// Opportunity score bands. The odds come from the holdout table in
// product_success/README.md: how often products in each band really reached
// the top 20% of sales in their category.

const GREEN = "#16A34A";
const AMBER = "#CA8A04";
const RED = "#DC2626";

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
  color: "#94A3B8",
  odds: null,
};

export function getScoreBand(score) {
  if (typeof score !== "number" || !Number.isFinite(score)) {
    return NOT_SCORED;
  }

  return BANDS.find((band) => score >= band.min) ?? BANDS.at(-1);
}
