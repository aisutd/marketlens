// A titled card around a chart (#50: the forecast pages each had a copy).
//
// alignCharts reserves a minimum height for the heading block, so that
// charts in side-by-side panels start on the same line when one
// description wraps to more lines than the other. Leave it off when the
// descriptions are short: it would only add blank space.
export default function ChartPanel({
  title,
  description,
  alignCharts = false,
  children,
}) {
  return (
    <article className="flex h-full min-w-0 flex-col border border-ink bg-card p-5 sm:p-7">
      <div className={alignCharts ? "min-h-[120px]" : undefined}>
        <h3 className="font-display text-2xl leading-tight">{title}</h3>

        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          {description}
        </p>
      </div>

      <div className="mt-5 flex flex-1 flex-col">{children}</div>
    </article>
  );
}
