// Display names for the factors behind an opportunity score.
//
// The /reasons API groups raw model features under a friendly label
// (predict.FRIENDLY in the scoring repo) and returns that label with the
// largest raw feature in the group. The label is the stable key: "title
// length" can arrive as title_len or title_words, "title meaning" as any of
// the title_emb_pca_* columns. Pages key their explanations on factorKey()
// and show factorName(), so a factor has one name everywhere.

// Labels whose plain sentence-case form would read badly or clash.
const NAME_OVERRIDES = {
  // Shown next to "brand track record in category"; without the
  // qualifier the two read as the same factor listed twice.
  "brand track record": "Brand track record overall",
};

export function factorKey(reason) {
  return String(reason?.label || "")
    .trim()
    .toLowerCase();
}

export function factorName(reason, fallback = "Other factor") {
  const key = factorKey(reason);

  if (!key) return fallback;

  return (
    NAME_OVERRIDES[key] ||
    key.charAt(0).toUpperCase() + key.slice(1)
  );
}
