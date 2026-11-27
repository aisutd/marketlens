// The numbered section heading used across the app (#50: it had six
// copies). The copies differed in two ways, kept here as props so the
// pages look exactly as before:
// - descriptionLeading: "7" (forecast and feasibility pages) or
//   "relaxed" (Overview, Score Details).
// - size "form": the smaller heading inside the Discover form, which
//   always shows its description.

export default function SectionHeading({
  number,
  eyebrow,
  title,
  description,
  descriptionLeading = "7",
  size = "page",
}) {
  const form = size === "form";

  return (
    <div>
      <p className="eyebrow flex items-center gap-3 text-muted-foreground">
        <span className="text-primary">{number}</span>
        <span className="h-px w-8 bg-current" />
        {eyebrow}
      </p>

      <h2
        className={
          form
            ? "mt-4 font-display text-3xl leading-tight"
            : "mt-4 font-display text-3xl leading-tight sm:text-4xl"
        }
      >
        {title}
      </h2>

      {(form || description) && (
        <p
          className={
            form
              ? "mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground"
              : `mt-4 max-w-2xl text-sm ${
                  descriptionLeading === "relaxed"
                    ? "leading-relaxed"
                    : "leading-7"
                } text-muted-foreground`
          }
        >
          {description}
        </p>
      )}
    </div>
  );
}
