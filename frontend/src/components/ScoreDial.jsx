// The half-circle 0-100 score gauge (#50: the landing page and Try It Live
// each had an identical copy). `label` starts the screen-reader name,
// e.g. "Example opportunity score" -> "Example opportunity score 70 out
// of 100". The arc is keyed on the value so its sweep replays when the
// score changes.
//
// `placeholder` is the empty-state ghost: it draws only the dial, with no
// number or caption, and is hidden from assistive technology, so nothing
// shows or announces a score of 0 before there is one (#78).
export default function ScoreDial({
  score,
  label,
  caption = "out of 100",
  placeholder = false,
}) {
  const value = Math.max(
    0,
    Math.min(100, Number(score) || 0)
  );

  const ticks = Array.from(
    { length: 11 },
    (_, index) => index * 10
  );

  return (
    <div className="relative">
      <svg
        viewBox="0 0 200 116"
        className="w-full"
        {...(placeholder
          ? { "aria-hidden": "true" }
          : { role: "img", "aria-label": `${label} ${value} out of 100` })}
      >
        {ticks.map((tick) => {
          const angle =
            Math.PI - (tick / 100) * Math.PI;

          const outer = 92;

          const inner =
            tick % 50 === 0 ? 82 : 86;

          return (
            <line
              key={tick}
              x1={100 + outer * Math.cos(angle)}
              y1={104 - outer * Math.sin(angle)}
              x2={100 + inner * Math.cos(angle)}
              y2={104 - inner * Math.sin(angle)}
              className="stroke-muted-foreground"
              strokeWidth={1}
            />
          );
        })}

        <path
          d="M 24 104 A 76 76 0 0 1 176 104"
          fill="none"
          className="stroke-secondary"
          strokeWidth={12}
        />

        <path
          key={value}
          d="M 24 104 A 76 76 0 0 1 176 104"
          fill="none"
          pathLength={100}
          strokeDasharray="100"
          strokeDashoffset={100 - value}
          className="stroke-primary animate-sweep"
          style={{ "--dash-from": 100 }}
          strokeWidth={12}
        />
      </svg>

      {!placeholder && (
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
          <span className="font-display tabular text-6xl leading-none text-foreground">
            {value}
          </span>

          <span className="eyebrow mt-2 text-muted-foreground">
            {caption}
          </span>
        </div>
      )}
    </div>
  );
}
