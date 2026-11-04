
import { getScoreBand } from "../constants/scoreBands";

/**
 * Says what an opportunity score means: where the product ranks
 * among its category's listings, and how often such scores sell.
 */
export default function ScoreSentence({ score, categoryName }) {
  const peers = categoryName
    ? `real ${categoryName} listings`
    : "real products in this category";

  const { odds } = getScoreBand(score);

  return (
    <>
      <p className="mt-2 text-sm text-[#475569]">
        Beats {score}% of {peers}.
      </p>

      <p className="mt-1 text-sm text-[#475569]">
        {odds.charAt(0).toUpperCase() + odds.slice(1)} (average is
        1 in 5)
      </p>
    </>
  );
}
