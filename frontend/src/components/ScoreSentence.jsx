
import { getScoreBand } from "../constants/scoreBands";

/**
 * Says what an opportunity score means: where the product ranks
 * among its category's listings, and how often such scores sell.
 */
export default function ScoreSentence({ score, categoryName }) {
  const rank =
    score === 100
      ? `Ranks above every real ${
          categoryName
            ? `${categoryName} listing`
            : "product in this category"
        } in our data.`
      : `Beats ${score}% of real ${
          categoryName
            ? `${categoryName} listings`
            : "products in this category"
        }.`;

  return (
    <>
      <p className="mt-2 text-sm text-[#475569]">{rank}</p>

      <p className="mt-1 text-sm text-[#475569]">
        {getScoreBand(score).odds}
      </p>
    </>
  );
}
