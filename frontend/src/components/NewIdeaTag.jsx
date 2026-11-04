
/**
 * Shown when the launch-time model scored the product,
 * which never looks at stars or reviews.
 */
export default function NewIdeaTag({ prediction }) {
  if (prediction?.model_used !== "launch") {
    return null;
  }

  return (
    <span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
      Scored as a new idea (no reviews used)
    </span>
  );
}
