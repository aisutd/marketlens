
import { useState } from "react";
import { Bookmark } from "lucide-react";

import { auth } from "../services/firebase";
import { saveProduct } from "../services/savedProducts";

export default function SaveProductButton({
  product = null,
  prediction = null,
  forecast = null,
}) {
  const [status, setStatus] = useState("");

  function handleSave() {
    const user = auth?.currentUser;

    if (!user) {
      setStatus("Please sign in to save products.");
      return;
    }

    const isOpportunityAnalysis =
      !forecast && product && prediction;

    const isForecastAnalysis =
      forecast &&
      ["existing", "launch"].includes(forecast.type);

    if (!isOpportunityAnalysis && !isForecastAnalysis) {
      setStatus("No valid analysis available to save.");
      return;
    }

    const analysis = {
      product: product ?? forecast?.product ?? null,
      scoredProduct: isOpportunityAnalysis
        ? product
        : null,
      prediction: isOpportunityAnalysis
        ? prediction
        : null,
      forecast: isForecastAnalysis
        ? forecast
        : null,
      suggestedPrices: {},
    };

    try {
      saveProduct(user.uid, analysis);
      setStatus("Product saved successfully.");
    } catch (error) {
      console.error("Unable to save product:", error);
      setStatus(
        "Unable to save product. Please try again."
      );
    }
  }

  return (
    <div className="mt-6 flex flex-col items-start gap-3">
      <button
        type="button"
        onClick={handleSave}
        className="inline-flex items-center gap-2 rounded-md border border-ink bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-offset-sm transition-colors hover:opacity-90"
      >
        <Bookmark size={18} />
        Save Product
      </button>

      {status && (
        <p
          role="status"
          className="text-sm text-muted-foreground"
        >
          {status}
        </p>
      )}
    </div>
  );
}
