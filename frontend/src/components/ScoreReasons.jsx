
const MAX_PER_SIDE = 3;

function Chips({ items, sign, className }) {
  return (items ?? []).slice(0, MAX_PER_SIDE).map((reason) => (
    <span
      key={`${sign}${reason.label}`}
      className={`rounded-full border px-3 py-1 text-xs font-medium ${className}`}
    >
      {sign} {reason.label}
    </span>
  ));
}

/**
 * What pushed the score up (green) and down (red).
 */
export default function ScoreReasons({ reasons }) {
  if (!reasons) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <Chips
        items={reasons.reasons_up}
        sign="+"
        className="border-green-200 bg-green-50 text-green-800"
      />

      <Chips
        items={reasons.reasons_down}
        sign="−"
        className="border-red-200 bg-red-50 text-red-800"
      />
    </div>
  );
}
