import { cardHover } from "../lib/cards";
import { toNumber } from "../lib/format";

// One forecast metric: label, headline value, explanation and the model's
// range (#50: the Sales and Launch pages each had their own copy).
//
// `format` turns a metric ({ value, unit }) into display text. It stays with
// the page because the pages round differently: Launch shows whole dollars
// and one-decimal percentages, Sales cents and two decimals.

// The range as [low, high] when it is usable: two numbers, low <= value <= high.
function metricRange(metric) {
  const range = metric?.range;
  const value = toNumber(metric?.value);

  if (!Array.isArray(range) || range.length !== 2 || value === null) {
    return null;
  }

  const low = toNumber(range[0]);
  const high = toNumber(range[1]);

  if (
    low === null ||
    high === null ||
    low > high ||
    value < low ||
    value > high
  ) {
    return null;
  }

  return [low, high];
}

export function RangeText({ metric, format }) {
  const range = metricRange(metric);

  if (!range) return null;

  const low = format({ value: range[0], unit: metric.unit });
  const high = format({ value: range[1], unit: metric.unit });

  // Both ends print the same (e.g. "under 0.1%"): the range adds nothing.
  if (low === high) return null;

  return (
    <p className="mt-3 text-xs leading-6 text-muted-foreground">
      Estimated range: {low} – {high}
    </p>
  );
}

export default function MetricCard({
  label,
  metric,
  format,
  description,
  highlighted = false,
}) {
  return (
    <article
      className={
        "flex min-h-48 min-w-0 flex-col justify-between border border-ink p-6 " +
        (highlighted ? "bg-surface-warm " : "bg-card ") +
        cardHover
      }
    >
      <p className="eyebrow text-muted-foreground">{label}</p>

      <div className="mt-8">
        {/* Smaller on phones: whole-dollar totals like $131,544 wrap at 4xl. */}
        <p className="break-words font-display text-3xl leading-tight sm:text-4xl">
          {format(metric)}
        </p>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {description}
        </p>

        <RangeText metric={metric} format={format} />
      </div>
    </article>
  );
}
