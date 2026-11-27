// Recharts tooltip in the app's card style (#50: Launch feasibility and the
// launch forecast each had a copy). Recharts passes `active` and `payload`;
// the page passes `format` for the value, since pages round differently.
export default function ChartTooltip({ active, payload, format }) {
  if (!active || !payload?.length) {
    return null;
  }

  const entry = payload[0];

  return (
    <div className="border border-ink bg-card px-4 py-3 shadow-offset">
      <p className="text-sm font-semibold">
        {entry.payload?.name || entry.name}
      </p>

      <p className="mt-2 font-mono text-sm">{format(entry.value)}</p>
    </div>
  );
}
