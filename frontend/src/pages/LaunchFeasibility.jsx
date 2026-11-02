
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  rescoreProduct,
  simulatePrices,
} from "../services/marketlensApi";

const currency = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);

const defaultCosts = {
  units: "500",
  manufacturing: "7.50",
  shipping: "2.00",
  amazonFees: "5.00",
  advertising: "3.00",
};

function ScenarioField({ label, value, onChange, isUnits = false }) {
  return (
    <label className="grid gap-2 sm:grid-cols-[1fr_202px] sm:items-center sm:gap-4">
      <span className="text-[13px] font-medium text-[#25334A]">
        {label}
      </span>
      <input
        type="number"
        min={isUnits ? "0" : "0"}
        step={isUnits ? "1" : "0.01"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-[7px] border border-[#D7E0EB] bg-white px-4 text-sm font-semibold text-[#25334A] outline-none focus:border-[#193B66] focus:ring-2 focus:ring-blue-100"
      />
    </label>
  );
}

function MetricRow({ label, value, highlight = false }) {
  return (
    <div className="flex min-h-[61px] items-center justify-between gap-4 border-b border-[#EDF1F6] last:border-b-0">
      <span className="text-[15px] text-[#25334A]">
        {label}
      </span>
      <span
        className={`text-right text-[22px] font-semibold ${
          highlight ? "text-[#167553]" : "text-[#193B66]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export default function LaunchFeasibility({
  product,
  prediction,
}) {
  const [scenario, setScenario] = useState(() => ({
    price: String(product?.price ?? ""),
    ...defaultCosts,
  }));

  const [rescore, setRescore] = useState(null);
  const [simulations, setSimulations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const resetResults = () => {
    setRescore(null);
    setSimulations([]);
    setError("");
  };

  const updateField = (field, value) => {
    setScenario((previous) => ({
      ...previous,
      [field]: value,
    }));
    resetResults();
  };

  const resetAssumptions = () => {
    setScenario({
      price: String(product?.price ?? ""),
      ...defaultCosts,
    });
    resetResults();
  };

  const values = Object.fromEntries(
    Object.entries(scenario).map(([key, value]) => [
      key,
      Number(value),
    ])
  );

  const isValid =
    Object.values(scenario).every(
      (value) =>
        value !== "" &&
        Number.isFinite(Number(value)) &&
        Number(value) >= 0
    ) &&
    values.price > 0 &&
    values.price <= 100000 &&
    Number.isSafeInteger(values.units);

  const unitCost =
    values.manufacturing +
    values.shipping +
    values.amazonFees +
    values.advertising;

  const revenue = values.price * values.units;
  const totalCosts = unitCost * values.units;
  const profit = revenue - totalCosts;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
  const roi =
    totalCosts > 0 ? (profit / totalCosts) * 100 : null;

  const metrics = [
    ["Revenue", currency(revenue)],
    ["Total costs", currency(totalCosts)],
    ["Estimated profit", currency(profit), true],
    ["Profit margin", `${margin.toFixed(1)}%`],
    [
      "Return on investment",
      roi === null ? "N/A" : `${roi.toFixed(1)}%`,
    ],
    [
      "Break-even units",
      values.price > unitCost
        ? "0 (no fixed costs)"
        : "Not reachable",
    ],
  ];

  const runSimulation = async () => {
    if (!product || !prediction || !isValid || loading) {
      return;
    }

    setLoading(true);
    resetResults();

    const originalPrice = Number(product.price);
    const newPrice = values.price;

    const prices = [
      newPrice * 0.9,
      newPrice,
      newPrice * 1.1,
    ].map((price) =>
      Math.min(
        100000,
        Math.max(0.01, Number(price.toFixed(2)))
      )
    );

    try {
      const [scoreResponse, whatIfResponse] =
        await Promise.all([
          rescoreProduct(product, { price: newPrice }),
          simulatePrices(product, prices),
        ]);

      setRescore(scoreResponse);
      setSimulations(whatIfResponse);
    } catch (err) {
      setError(err.message || "Simulation failed.");
    } finally {
      setLoading(false);
    }
  };

  if (!product || !prediction) {
    return (
      <main className="mx-auto max-w-[1248px] px-6 py-12">
        <h1 className="text-3xl font-bold text-[#25334A]">
          What-If scenario simulator
        </h1>
        <p className="mt-4 text-[#61738B]">
          Search and score a product before opening the
          simulator.
        </p>
        <Link
          to="/discover"
          className="mt-6 inline-block rounded-lg bg-[#FFD45A] px-6 py-3 font-semibold text-[#25334A]"
        >
          Search a product →
        </Link>
      </main>
    );
  }

  const scenarioFields = [
    ["Selling price", "price"],
    ["Monthly unit sales", "units"],
    ["Manufacturing cost / unit", "manufacturing"],
    ["Shipping cost / unit", "shipping"],
    ["Amazon fees / unit", "amazonFees"],
    ["Advertising cost / unit", "advertising"],
  ];

  return (
    <main className="mx-auto max-w-[1440px] px-6 py-9 lg:px-24">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <h1 className="text-[31px] font-bold text-[#25334A]">
            What-If scenario simulator
          </h1>
          <p className="mt-2 text-base text-[#61738B]">
            Adjust costs and price after searching a
            product. Compare profitability instantly.
          </p>
        </div>

        <Link
          to="/overview"
          className="shrink-0 rounded-lg bg-[#193B66] px-6 py-3 text-center text-[13px] font-semibold text-white hover:bg-[#122E52]"
        >
          Back to overview →
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-[#D7E0EB] bg-white px-5 py-3 text-sm">
        <span className="font-semibold text-[#25334A]">
          {product.title}
        </span>
        <span className="text-[#61738B]">
          Original price: {currency(Number(product.price))}
        </span>
        <span className="text-[#61738B]">
          Opportunity score: {prediction.opportunity_score}/100
        </span>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,535px)_minmax(0,1fr)]">
        <section className="rounded-xl bg-[#F6F9FD] p-6">
          <h2 className="mb-6 text-[21px] font-semibold text-[#25334A]">
            Your scenario
          </h2>

          <div className="space-y-6">
            {scenarioFields.map(([label, field]) => (
              <ScenarioField
                key={field}
                label={label}
                value={scenario[field]}
                isUnits={field === "units"}
                onChange={(value) => updateField(field, value)}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={resetAssumptions}
            className="mt-8 rounded-lg bg-[#E7EFF9] px-6 py-3 text-[13px] font-semibold text-[#193B66] hover:bg-[#D8E7F8]"
          >
            Reset assumptions
          </button>
        </section>

        <section className="rounded-xl bg-white p-7">
          <h2 className="mb-5 text-[21px] font-semibold text-[#25334A]">
            Estimated monthly performance
          </h2>

          <div>
            {metrics.map(([label, value, highlight]) => (
              <MetricRow
                key={label}
                label={label}
                value={isValid ? value : "—"}
                highlight={highlight && isValid && profit >= 0}
              />
            ))}
          </div>

          <p className="mt-8 text-xs leading-5 text-[#748198]">
            Illustrative estimates only. Figures update
            from your entered assumptions and are not
            model-generated sales forecasts. Fixed costs
            are not included.
          </p>
        </section>
      </div>

      <section className="mt-6 rounded-xl border border-[#D7E0EB] bg-white p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-semibold text-[#25334A]">
              AI price simulation
            </h2>
            <p className="mt-2 text-sm text-[#61738B]">
              Compare opportunity scores at three prices
              using the current searched product.
            </p>
          </div>

          <button
            type="button"
            onClick={runSimulation}
            disabled={!isValid || loading}
            className="rounded-lg bg-[#FFD45A] px-6 py-3 text-sm font-semibold text-[#25334A] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Simulating..." : "Run simulation"}
          </button>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        {rescore && (
          <div className="mt-6 rounded-lg bg-[#F6F9FD] p-5">
            <p className="text-sm text-[#61738B]">
              Recalculated opportunity score
            </p>
            <p className="mt-2 text-3xl font-bold text-[#193B66]">
              {rescore.opportunity_score}/100
            </p>
            <p className="mt-2 text-sm text-[#61738B]">
              Score change: {rescore.score_change > 0 ? "+" : ""}
              {rescore.score_change} points
            </p>
          </div>
        )}

        {simulations.length > 0 && (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#D7E0EB] text-[#61738B]">
                  <th className="py-3">Selling price</th>
                  <th className="py-3">Opportunity score</th>
                  <th className="py-3">Probability</th>
                </tr>
              </thead>
              <tbody>
                {simulations.map((result, index) => (
                  <tr
                    key={`${result.price}-${index}`}
                    className="border-b border-[#EDF1F6]"
                  >
                    <td className="py-4">
                      {currency(result.price)}
                    </td>
                    <td className="py-4 font-semibold">
                      {result.opportunity_score}/100
                    </td>
                    <td className="py-4">
                      {(result.probability * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
