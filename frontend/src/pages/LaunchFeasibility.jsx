
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Calculator,
  DollarSign,
  Info,
  Layers3,
  Package,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

import {
  rescoreProduct,
  simulatePrices,
} from "../services/marketlensApi";

// ========================================
// THEME AND CONSTANTS
// ========================================

const COLORS = {
  navy: "#193B66",
  gold: "#D4A529",
  green: "#13795B",
  red: "#B94747",
  slate: "#8FA4BA",
  muted: "#61738B",
};

const DEFAULT_COSTS = {
  units: "500",
  manufacturing: "7.50",
  shipping: "2.00",
  amazonFees: "5.00",
  advertising: "3.00",
};

const COST_FIELDS = [
  {
    id: "manufacturing",
    label: "Manufacturing",
    description: "Product production cost per unit",
    color: "#193B66",
  },
  {
    id: "shipping",
    label: "Shipping",
    description: "Shipping cost per unit",
    color: "#8FA4BA",
  },
  {
    id: "amazonFees",
    label: "Amazon fees",
    description: "Marketplace fees per unit",
    color: "#D4A529",
  },
  {
    id: "advertising",
    label: "Advertising",
    description: "Advertising cost per unit",
    color: "#7C6BB1",
  },
];

const ENTER_TRANSITION = {
  duration: 0.45,
  ease: "easeOut",
};

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// ========================================
// FORMATTING AND CALCULATIONS
// ========================================

function numberOrNull(value) {
  if (
    value === "" ||
    value == null ||
    !Number.isFinite(Number(value))
  ) {
    return null;
  }

  return Number(value);
}

function money(value) {
  const number = numberOrNull(value);

  return number === null
    ? "—"
    : currencyFormatter.format(number);
}

function numberText(value) {
  const number = numberOrNull(value);

  return number === null
    ? "—"
    : numberFormatter.format(number);
}

function percent(value) {
  const number = numberOrNull(value);

  return number === null
    ? "—"
    : `${number.toFixed(1)}%`;
}

function signedMoney(value) {
  const number = numberOrNull(value);

  if (number === null) return "—";

  return `${number > 0 ? "+" : number < 0 ? "−" : ""}${money(
    Math.abs(number)
  )}`;
}

function signedPercent(value) {
  const number = numberOrNull(value);

  if (number === null) return "—";

  return `${number > 0 ? "+" : ""}${number.toFixed(1)}%`;
}

function calculateFinancials(values) {
  const unitCost =
    values.manufacturing +
    values.shipping +
    values.amazonFees +
    values.advertising;

  const revenue = values.price * values.units;
  const totalCosts = unitCost * values.units;
  const profit = revenue - totalCosts;

  const margin =
    revenue > 0 ? (profit / revenue) * 100 : 0;

  const roi =
    totalCosts > 0
      ? (profit / totalCosts) * 100
      : null;

  return {
    unitCost,
    revenue,
    totalCosts,
    profit,
    margin,
    roi,
    contributionPerUnit: values.price - unitCost,
  };
}

function calculateChange(current, baseline) {
  if (
    !Number.isFinite(current) ||
    !Number.isFinite(baseline)
  ) {
    return null;
  }

  return current - baseline;
}

function validSuggestedPrice(suggestedPrice) {
  const value = numberOrNull(suggestedPrice);

  return value !== null &&
    value > 0 &&
    value <= 100000
    ? value
    : null;
}

// ========================================
// SHARED SECTION HEADING
// ========================================

function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}) {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
      <div>
        {eyebrow && (
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.13em] text-[#A77E1C]">
            {eyebrow}
          </p>
        )}

        <h2 className="text-xl font-bold tracking-tight text-[#25334A] sm:text-2xl">
          {title}
        </h2>

        {description && (
          <p className="mt-2 text-sm leading-6 text-[#61738B]">
            {description}
          </p>
        )}
      </div>

      {action}
    </div>
  );
}

// ========================================
// ANIMATED METRIC CARD
// ========================================

function MetricCard({
  label,
  value,
  description,
  icon: Icon,
  variant = "navy",
  delay = 0,
}) {
  const variants = {
    navy: {
      background:
        "linear-gradient(135deg, #193B66, #275788)",
      text: "text-white",
      muted: "text-[#DCE8F5]",
      icon: "bg-white/15 text-[#FFD45A]",
    },
    gold: {
      background:
        "linear-gradient(135deg, #F6C94D, #F9DD86)",
      text: "text-[#25334A]",
      muted: "text-[#705A31]",
      icon: "bg-white/40 text-[#705211]",
    },
    green: {
      background:
        "linear-gradient(135deg, #11684F, #219674)",
      text: "text-white",
      muted: "text-[#D6F3E9]",
      icon: "bg-white/15 text-[#E1FFF2]",
    },
  };

  const style = variants[variant];

  return (
    <motion.article
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        ...ENTER_TRANSITION,
        delay,
      }}
      whileHover={{ y: -5 }}
      className="relative flex min-h-[210px] min-w-0 flex-col justify-between overflow-hidden rounded-2xl p-6 shadow-md"
      style={{ background: style.background }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full border-[30px] border-white/10"
      />

      <div className="relative z-10 flex items-start justify-between gap-3">
        <p className={`text-sm font-semibold ${style.muted}`}>
          {label}
        </p>

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${style.icon}`}
        >
          <Icon size={21} aria-hidden="true" />
        </div>
      </div>

      <div className="relative z-10 mt-8">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={String(value)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.16 }}
            aria-live="polite"
            className={`break-words text-[clamp(1.8rem,3vw,2.6rem)] font-bold tracking-tight ${style.text}`}
          >
            {value}
          </motion.p>
        </AnimatePresence>

        <p className={`mt-3 text-sm ${style.muted}`}>
          {description}
        </p>
      </div>
    </motion.article>
  );
}

// ========================================
// SYNCHRONIZED SLIDER + INPUT
// ========================================

function ScenarioControl({
  label,
  description,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 0.01,
  prefix = "",
  suffix = "",
  icon: Icon,
}) {
  const numeric = numberOrNull(value);

  const sliderValue =
    numeric === null
      ? min
      : Math.max(min, Math.min(max, numeric));

  const valid =
    numeric !== null &&
    numeric >= min &&
    (numeric <= 100000);

  return (
    <div className="rounded-2xl border border-[#E4EBF3] bg-white p-4 sm:p-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-center gap-3">
          {Icon && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EDF3FA] text-[#193B66]">
              <Icon size={19} aria-hidden="true" />
            </div>
          )}

          <div className="min-w-0">
            <label className="text-sm font-bold text-[#25334A]">
              {label}
            </label>

            {description && (
              <p className="mt-1 text-xs leading-5 text-[#61738B]">
                {description}
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {prefix && (
            <span className="text-sm font-semibold text-[#61738B]">
              {prefix}
            </span>
          )}

          <input
            type="number"
            aria-label={label}
            value={value}
            min={min}
            max={100000}
            step={step}
            onChange={(event) =>
              onChange(event.target.value)
            }
            className={`h-11 w-32 rounded-xl border bg-white px-3 text-right text-sm font-bold text-[#25334A] outline-none focus:ring-2 focus:ring-[#193B66]/15 ${
              valid
                ? "border-[#D7E0EB] focus:border-[#193B66]"
                : "border-red-400 focus:border-red-500"
            }`}
          />

          {suffix && (
            <span className="text-xs font-medium text-[#61738B]">
              {suffix}
            </span>
          )}
        </div>
      </div>

      <input
        type="range"
        aria-label={`${label} slider`}
        min={min}
        max={max}
        step={step}
        value={sliderValue}
        onChange={(event) =>
          onChange(event.target.value)
        }
        disabled={max <= min}
        className="mt-5 w-full cursor-pointer accent-[#193B66] disabled:cursor-not-allowed"
      />

      <div className="mt-2 flex justify-between text-xs text-[#8FA0B4]">
        <span>
          {prefix}
          {numberText(min)}
        </span>

        <span>
          {prefix}
          {numberText(max)}
        </span>
      </div>
    </div>
  );
}

// ========================================
// FINANCIAL DETAIL ROW
// ========================================

function DetailRow({
  label,
  value,
  highlight = false,
  negative = false,
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[#EDF1F6] py-4 last:border-b-0">
      <span className="text-sm text-[#61738B]">
        {label}
      </span>

      <span
        className={`text-right text-base font-bold ${
          negative
            ? "text-red-700"
            : highlight
              ? "text-[#13795B]"
              : "text-[#25334A]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

// ========================================
// RECHARTS TOOLTIP
// ========================================

function FinancialTooltip({
  active,
  payload,
}) {
  if (!active || !payload?.length) return null;

  const entry = payload[0];

  return (
    <div className="rounded-xl border border-[#D7E0EB] bg-white px-4 py-3 shadow-xl">
      <p className="text-sm font-semibold text-[#25334A]">
        {entry.payload?.name || entry.name}
      </p>

      <p className="mt-1 text-sm text-[#193B66]">
        {money(entry.value)}
      </p>
    </div>
  );
}

// ========================================
// REVENUE VS. COSTS
// ========================================

function RevenueCostChart({ financials }) {
  const data = [
    {
      name: "Revenue",
      value: financials.revenue,
      color: COLORS.gold,
    },
    {
      name: "Total costs",
      value: financials.totalCosts,
      color: COLORS.navy,
    },
  ];

  return (
    <div
      className="h-[275px] w-full"
      role="img"
      aria-label={`Revenue ${money(
        financials.revenue
      )}; total costs ${money(financials.totalCosts)}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{
            top: 14,
            right: 15,
            bottom: 0,
            left: 0,
          }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="#EDF1F5"
          />

          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{
              fill: COLORS.muted,
              fontSize: 12,
            }}
          />

          <YAxis
            axisLine={false}
            tickLine={false}
            width={70}
            tick={{
              fill: COLORS.muted,
              fontSize: 11,
            }}
            tickFormatter={(value) =>
              value >= 1000
                ? `$${(value / 1000).toFixed(1)}k`
                : `$${value}`
            }
          />

          <Tooltip content={<FinancialTooltip />} />

          <Bar
            dataKey="value"
            radius={[8, 8, 0, 0]}
            maxBarSize={95}
            isAnimationActive
            animationDuration={350}
          >
            {data.map((entry) => (
              <Cell
                key={entry.name}
                fill={entry.color}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ========================================
// COST BREAKDOWN
// ========================================

function CostBreakdown({ values }) {
  const items = COST_FIELDS.map((field) => ({
    ...field,
    amount: values[field.id] * values.units,
  }));

  const total = items.reduce(
    (sum, item) => sum + item.amount,
    0
  );

  const chartData = [
    Object.fromEntries([
      ["name", "Costs"],
      ...items.map((item) => [
        item.id,
        item.amount,
      ]),
    ]),
  ];

  return (
    <section className="rounded-2xl border border-[#D7E0EB] bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-[#EDF3FA] p-3 text-[#193B66]">
          <Layers3 size={21} />
        </div>

        <div>
          <h3 className="text-lg font-bold text-[#25334A]">
            Where your costs go
          </h3>
          <p className="mt-1 text-sm text-[#61738B]">
            Estimated monthly operating costs
          </p>
        </div>
      </div>

      <div
        className="mt-6 h-[100px] w-full"
        role="img"
        aria-label={items
          .map(
            (item) =>
              `${item.label} ${money(item.amount)}`
          )
          .join(", ")}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={chartData}
            margin={{
              top: 10,
              right: 0,
              bottom: 10,
              left: 0,
            }}
          >
            {/* Fixed to the total so the stacked bar fills
                the width; an auto domain rounds up (8,750
                becomes 10,000) and leaves a gap. */}
            <XAxis
              type="number"
              domain={[0, total || 1]}
              hide
            />
            <YAxis
              type="category"
              dataKey="name"
              hide
            />

            {items.map((item) => (
              <Bar
                key={item.id}
                dataKey={item.id}
                stackId="costs"
                fill={item.color}
                isAnimationActive
                animationDuration={350}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => {
          const share =
            total > 0
              ? (item.amount / total) * 100
              : 0;

          return (
            <div
              key={item.id}
              className="rounded-xl bg-[#F6F9FD] p-4"
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{
                    backgroundColor: item.color,
                  }}
                />
                <p className="text-xs font-medium text-[#61738B]">
                  {item.label}
                </p>
              </div>

              <p className="mt-3 text-lg font-bold text-[#25334A]">
                {money(item.amount)}
              </p>

              <p className="mt-1 text-xs text-[#61738B]">
                {share.toFixed(1)}% of costs
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ========================================
// ORIGINAL VS. SCENARIO COMPARISON
// ========================================

function ComparisonCard({
  label,
  original,
  current,
  format = money,
}) {
  const difference = calculateChange(
    current,
    original
  );

  const isPositive =
    difference !== null && difference > 0;

  const isNegative =
    difference !== null && difference < 0;

  return (
    <div className="rounded-2xl border border-[#D7E0EB] bg-white p-5 shadow-sm">
      <p className="text-sm font-bold text-[#25334A]">
        {label}
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-[#F5F8FC] p-3">
          <p className="text-xs text-[#61738B]">
            Original price
          </p>

          <p className="mt-2 break-words text-lg font-bold text-[#25334A]">
            {format(original)}
          </p>
        </div>

        <div className="rounded-xl bg-[#EDF7F2] p-3">
          <p className="text-xs text-[#61738B]">
            Scenario
          </p>

          <p className="mt-2 break-words text-lg font-bold text-[#13795B]">
            {format(current)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        {isPositive ? (
          <ArrowUpRight
            size={18}
            className="text-[#13795B]"
          />
        ) : isNegative ? (
          <ArrowDownRight
            size={18}
            className="text-[#B94747]"
          />
        ) : (
          <span className="text-sm text-[#61738B]">
            —
          </span>
        )}

        <p
          className={`text-sm font-semibold ${
            isPositive
              ? "text-[#13795B]"
              : isNegative
                ? "text-[#B94747]"
                : "text-[#61738B]"
          }`}
        >
          {difference === null
            ? "Not comparable"
            : format === money
              ? signedMoney(difference)
              : `${difference > 0 ? "+" : ""}${format(
                  difference
                )}`}
        </p>

        <span className="text-xs text-[#61738B]">
          difference
        </span>
      </div>
    </div>
  );
}

// ========================================
// AI PRICE SIMULATION
// ========================================

function AIPriceSimulation({
  product,
  prediction,
  isValid,
  loading,
  error,
  rescore,
  simulations,
  onRun,
}) {
  const baselineScore = numberOrNull(
    prediction?.opportunity_score
  );

  const newScore = numberOrNull(
    rescore?.opportunity_score
  );

  const scoreChange = numberOrNull(
    rescore?.score_change
  );

  const chartData = Array.isArray(simulations)
    ? simulations
        .map((item) => ({
          price: numberOrNull(item.price),
          score: numberOrNull(item.opportunity_score),
          probability: numberOrNull(item.probability),
        }))
        .filter(
          (item) =>
            item.price !== null &&
            item.score !== null
        )
    : [];

  return (
    <section className="mt-10 rounded-2xl border border-[#D7E0EB] bg-white p-6 shadow-sm sm:p-7">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.13em] text-[#A77E1C]">
            Model-powered analysis
          </p>

          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[#FFF6DD] p-3 text-[#8B6B1E]">
              <Sparkles size={22} />
            </div>

            <h2 className="text-xl font-bold text-[#25334A] sm:text-2xl">
              AI price simulation
            </h2>
          </div>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#61738B]">
            Compare opportunity scores at three selling
            prices using the product scoring backend.
            Financial calculations above remain separate
            from these model results.
          </p>
        </div>

        <button
          type="button"
          disabled={!isValid || loading || !product || !prediction}
          onClick={onRun}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#FFD45A] px-6 py-3 text-sm font-bold text-[#25334A] transition hover:bg-[#F5C842] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#25334A]/30 border-t-[#25334A]" />
              Simulating...
            </>
          ) : (
            <>
              <Play size={17} fill="currentColor" />
              Run simulation
            </>
          )}
        </button>
      </div>

      <div className="mt-6 flex items-start gap-3 rounded-xl bg-[#F5F8FC] p-4">
        <Info
          size={19}
          className="mt-0.5 shrink-0 text-[#193B66]"
        />
        <p className="text-xs leading-6 text-[#61738B]">
          The model evaluates three prices: 10% below,
          equal to, and 10% above your selected scenario
          price, subject to the API's valid price limits.
          Running the simulation does not automatically
          alter your financial assumptions.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <AnimatePresence mode="wait">
        {rescore && (
          <motion.div
            key="rescore"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-6 grid gap-4 md:grid-cols-3"
          >
            <div className="rounded-2xl bg-[#F1F6FC] p-5">
              <p className="text-sm text-[#61738B]">
                Original score
              </p>

              <p className="mt-3 text-3xl font-bold text-[#193B66]">
                {baselineScore === null
                  ? "—"
                  : `${baselineScore}/100`}
              </p>
            </div>

            <div className="rounded-2xl bg-[#FFF8E5] p-5">
              <p className="text-sm text-[#61738B]">
                Recalculated score
              </p>

              <p className="mt-3 text-3xl font-bold text-[#25334A]">
                {newScore === null
                  ? "—"
                  : `${newScore}/100`}
              </p>
            </div>

            <div className="rounded-2xl bg-[#F0F8F4] p-5">
              <p className="text-sm text-[#61738B]">
                Score difference
              </p>

              <p
                className={`mt-3 text-3xl font-bold ${
                  scoreChange !== null && scoreChange < 0
                    ? "text-red-700"
                    : "text-[#13795B]"
                }`}
              >
                {scoreChange === null
                  ? "—"
                  : `${scoreChange > 0 ? "+" : ""}${scoreChange}`}
              </p>

              <p className="mt-2 text-xs text-[#61738B]">
                Opportunity-score points
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {chartData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-7"
        >
          <h3 className="text-lg font-bold text-[#25334A]">
            Price sensitivity
          </h3>

          <p className="mt-2 text-sm text-[#61738B]">
            Opportunity scores returned for the
            simulated selling prices.
          </p>

          <div
            className="mt-5 h-[250px] w-full"
            role="img"
            aria-label={chartData
              .map(
                (item) =>
                  `Price ${money(item.price)}: score ${item.score}`
              )
              .join("; ")}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{
                  top: 15,
                  right: 10,
                  bottom: 0,
                  left: 0,
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#EDF1F5"
                />

                <XAxis
                  dataKey="price"
                  tickFormatter={(value) =>
                    money(value)
                  }
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: COLORS.muted,
                    fontSize: 12,
                  }}
                />

                <YAxis
                  domain={[0, 100]}
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: COLORS.muted,
                    fontSize: 11,
                  }}
                />

                <Bar
                  dataKey="score"
                  radius={[8, 8, 0, 0]}
                  maxBarSize={95}
                  fill={COLORS.navy}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[450px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#D7E0EB] text-[#61738B]">
                  <th className="py-3 pr-4 font-semibold">
                    Selling price
                  </th>
                  <th className="py-3 pr-4 font-semibold">
                    Opportunity score
                  </th>
                  <th className="py-3 font-semibold">
                    Model probability
                  </th>
                </tr>
              </thead>

              <tbody>
                {chartData.map((item, index) => (
                  <tr
                    key={`${item.price}-${index}`}
                    className="border-b border-[#EDF1F6] last:border-b-0"
                  >
                    <td className="py-4 pr-4 font-medium text-[#25334A]">
                      {money(item.price)}
                    </td>

                    <td className="py-4 pr-4 font-bold text-[#193B66]">
                      {item.score}/100
                    </td>

                    <td className="py-4 text-[#61738B]">
                      {item.probability !== null &&
                      item.probability >= 0 &&
                      item.probability <= 1
                        ? percent(
                            item.probability * 100
                          )
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {!rescore &&
        chartData.length === 0 &&
        !loading &&
        !error && (
          <div className="mt-6 flex flex-col items-center rounded-xl border border-dashed border-[#D7E0EB] bg-[#FAFCFE] px-5 py-9 text-center">
            <Target
              size={29}
              className="text-[#8FA4BA]"
            />

            <p className="mt-4 font-semibold text-[#25334A]">
              Ready to compare prices
            </p>

            <p className="mt-2 max-w-md text-sm leading-6 text-[#61738B]">
              Run the scoring simulation to see how the
              model evaluates your selected price and
              nearby alternatives.
            </p>
          </div>
        )}
    </section>
  );
}

// ========================================
// MAIN WHAT-IF SIMULATOR
// ========================================

export default function LaunchFeasibility({
  product,
  prediction,
}) {
  const location = useLocation();

  const originalPrice = numberOrNull(
    product?.price
  );

  const suggestedPrice = validSuggestedPrice(
    location.state?.suggestedPrice
  );

  const startingPrice =
    suggestedPrice ?? originalPrice;

  const [scenario, setScenario] = useState(() => ({
    price:
      startingPrice === null
        ? ""
        : String(startingPrice),
    ...DEFAULT_COSTS,
  }));

  const [rescore, setRescore] = useState(null);
  const [simulations, setSimulations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Prevent outdated requests from restoring results
  // after the user changes the current assumptions.
  const requestVersion = useRef(0);

  useEffect(() => {
    return () => {
      requestVersion.current += 1;
    };
  }, []);

  function resetResults() {
    requestVersion.current += 1;
    setRescore(null);
    setSimulations([]);
    setError("");
    setLoading(false);
  }

  function updateField(field, value) {
    setScenario((previous) => ({
      ...previous,
      [field]: value,
    }));

    resetResults();
  }

  function resetAssumptions() {
    setScenario({
      price:
        originalPrice === null
          ? ""
          : String(originalPrice),
      ...DEFAULT_COSTS,
    });

    resetResults();
  }

  // ========================================
  // SCENARIO VALIDATION
  // ========================================

  const values = Object.fromEntries(
    Object.entries(scenario).map(
      ([key, value]) => [
        key,
        numberOrNull(value),
      ]
    )
  );

  const isValid =
    Object.values(values).every(
      (value) =>
        value !== null &&
        value >= 0 &&
        value <= 100000
    ) &&
    values.price > 0 &&
    Number.isSafeInteger(values.units);

  const financials = isValid
    ? calculateFinancials(values)
    : null;

  // The baseline uses the original selling price
  // with the CURRENT cost and volume assumptions.
  // This isolates the impact of changing price.
  const baselineValues =
    isValid &&
    originalPrice !== null &&
    originalPrice > 0
      ? {
          ...values,
          price: originalPrice,
        }
      : null;

  const baseline = baselineValues
    ? calculateFinancials(baselineValues)
    : null;

  // ========================================
  // SLIDER LIMITS
  // ========================================

  const priceSliderMax = Math.min(
    100000,
    Math.max(
      10,
      (originalPrice ?? 0) * 1.5,
      (values.price ?? 0) * 1.2
    )
  );

  const unitSliderMax = Math.min(
    100000,
    Math.max(
      1000,
      (values.units ?? 0) * 1.2
    )
  );

  function costSliderMax(field) {
    return Math.min(
      100000,
      Math.max(
        25,
        (values[field] ?? 0) * 1.4
      )
    );
  }

  // ========================================
  // AI SIMULATION
  // ========================================

  async function runSimulation() {
    if (
      !product ||
      !prediction ||
      !isValid ||
      loading
    ) {
      return;
    }

    const version = ++requestVersion.current;

    setLoading(true);
    setError("");
    setRescore(null);
    setSimulations([]);

    const selectedPrice = values.price;

    const prices = [
      selectedPrice * 0.9,
      selectedPrice,
      selectedPrice * 1.1,
    ].map((price) =>
      Math.min(
        100000,
        Math.max(
          0.01,
          Number(price.toFixed(2))
        )
      )
    );

    try {
      const [scoreResponse, whatIfResponse] =
        await Promise.all([
          rescoreProduct(product, {
            price: selectedPrice,
          }),
          simulatePrices(product, prices),
        ]);

      if (version !== requestVersion.current) {
        return;
      }

      setRescore(scoreResponse);
      setSimulations(
        Array.isArray(whatIfResponse)
          ? whatIfResponse
          : []
      );
    } catch (err) {
      if (version !== requestVersion.current) {
        return;
      }

      setError(
        err.message ||
          "Unable to complete the price simulation."
      );
    } finally {
      if (version === requestVersion.current) {
        setLoading(false);
      }
    }
  }

  // ========================================
  // EMPTY STATE
  // ========================================

  if (!product || !prediction) {
    return (
      <main className="mx-auto max-w-[1440px] px-6 py-12 lg:px-24">
        <h1 className="text-3xl font-bold text-[#25334A]">
          What-If scenario simulator
        </h1>

        <p className="mt-4 text-[#61738B]">
          Search and score a product before opening
          the simulator.
        </p>

        <Link
          to="/discover"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#FFD45A] px-6 py-3 font-semibold text-[#25334A]"
        >
          Discover products
          <ArrowRight size={18} />
        </Link>
      </main>
    );
  }

  const priceDifference =
    isValid &&
    originalPrice !== null &&
    originalPrice > 0
      ? ((values.price / originalPrice) - 1) * 100
      : null;

  return (
    <main className="mx-auto max-w-[1440px] px-5 py-8 text-[#0F172A] sm:px-8 lg:px-16 xl:px-24">
      {/* ====================================
          PAGE HEADER
      ==================================== */}

      <div className="text-xs text-[#61738B]">
        Discover
        <span className="mx-3">›</span>
        Opportunity Analysis
        <span className="mx-3">›</span>
        What-If Simulator
      </div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={ENTER_TRANSITION}
        className="mt-6 flex flex-col justify-between gap-5 md:flex-row md:items-start"
      >
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.13em] text-[#A77E1C]">
            MarketLens / Pricing Intelligence
          </p>

          <h1 className="text-3xl font-bold tracking-tight text-[#25334A] sm:text-4xl">
            What-If Simulator
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#61738B] sm:text-base">
            Experiment with selling prices and operating
            costs to understand how profitability changes.
          </p>
        </div>

        <Link
          to="/product-overview"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-[#D7E0EB] bg-white px-5 py-3 text-sm font-semibold text-[#193B66] shadow-sm transition hover:bg-[#F5F8FC]"
        >
          <ArrowLeft size={17} />
          Back to overview
        </Link>
      </motion.div>

      {/* ====================================
          PRODUCT SUMMARY
      ==================================== */}

      <motion.section
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          ...ENTER_TRANSITION,
          delay: 0.08,
        }}
        className="mt-7 flex flex-col justify-between gap-5 rounded-2xl border border-[#D7E0EB] bg-white p-6 shadow-sm sm:flex-row sm:items-center"
      >
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#EDF3FA] text-[#193B66]">
            <Package size={26} />
          </div>

          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-[#A77E1C]">
              Evaluated product
            </p>

            <h2 className="mt-2 break-words text-lg font-bold text-[#25334A]">
              {product.title || "Selected product"}
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="rounded-xl bg-[#F5F8FC] px-5 py-3">
            <p className="text-xs text-[#61738B]">
              Original price
            </p>
            <p className="mt-1 text-lg font-bold text-[#25334A]">
              {money(originalPrice)}
            </p>
          </div>

          <div className="rounded-xl bg-[#FFF6DD] px-5 py-3">
            <p className="text-xs text-[#8B6B1E]">
              Opportunity score
            </p>
            <p className="mt-1 text-lg font-bold text-[#25334A]">
              {numberText(prediction.opportunity_score)}
              /100
            </p>
          </div>
        </div>
      </motion.section>

      {/* ====================================
          KPI SUMMARY
      ==================================== */}

      <section className="mt-10">
        <SectionHeading
          eyebrow="Financial overview"
          title="Estimated monthly performance"
          description="Live calculations based on your scenario assumptions."
        />

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <MetricCard
            label="Estimated revenue"
            value={
              isValid
                ? money(financials.revenue)
                : "—"
            }
            description="Price multiplied by monthly unit sales"
            icon={DollarSign}
            variant="navy"
            delay={0.1}
          />

          <MetricCard
            label="Estimated profit"
            value={
              isValid
                ? money(financials.profit)
                : "—"
            }
            description="Revenue after estimated variable costs"
            icon={Wallet}
            variant="gold"
            delay={0.18}
          />

          <MetricCard
            label="Profit margin"
            value={
              isValid
                ? percent(financials.margin)
                : "—"
            }
            description="Profit as a percentage of revenue"
            icon={TrendingUp}
            variant="green"
            delay={0.26}
          />
        </div>
      </section>

      {/* ====================================
          SCENARIO CONTROLS
      ==================================== */}

      <section className="mt-10">
        <SectionHeading
          eyebrow="Scenario builder"
          title="Adjust your assumptions"
          description="Use the sliders or enter exact numbers. Financial results update immediately."
          action={
            <button
              type="button"
              onClick={resetAssumptions}
              className="inline-flex w-fit items-center gap-2 rounded-xl border border-[#D7E0EB] bg-white px-5 py-3 text-sm font-semibold text-[#193B66] transition hover:bg-[#F5F8FC]"
            >
              <RotateCcw size={17} />
              Reset assumptions
            </button>
          }
        />

        <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* LEFT: INPUTS */}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={ENTER_TRANSITION}
            className="min-w-0 rounded-2xl border border-[#D7E0EB] bg-[#F5F8FC] p-5 shadow-sm sm:p-6"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-white p-3 text-[#193B66] shadow-sm">
                <SlidersHorizontal size={22} />
              </div>

              <div>
                <h3 className="text-lg font-bold text-[#25334A]">
                  Scenario inputs
                </h3>

                <p className="mt-1 text-sm text-[#61738B]">
                  Pricing and monthly operating assumptions
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <ScenarioControl
                label="Selling price"
                description="Price charged per product"
                value={scenario.price}
                onChange={(value) =>
                  updateField("price", value)
                }
                min={0.01}
                max={priceSliderMax}
                step={0.01}
                prefix="$"
                icon={DollarSign}
              />

              <ScenarioControl
                label="Monthly unit sales"
                description="Assumed number of products sold monthly"
                value={scenario.units}
                onChange={(value) =>
                  updateField("units", value)
                }
                min={0}
                max={unitSliderMax}
                step={1}
                icon={Package}
              />

              <div className="pt-2">
                <p className="text-xs font-bold uppercase tracking-wide text-[#61738B]">
                  Variable costs per unit
                </p>
              </div>

              {COST_FIELDS.map((field) => (
                <ScenarioControl
                  key={field.id}
                  label={field.label}
                  description={field.description}
                  value={scenario[field.id]}
                  onChange={(value) =>
                    updateField(field.id, value)
                  }
                  min={0}
                  max={costSliderMax(field.id)}
                  step={0.01}
                  prefix="$"
                  icon={Calculator}
                />
              ))}
            </div>

            {!isValid && (
              <div
                role="alert"
                className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
              >
                Enter a valid selling price, nonnegative
                costs, and a whole-number monthly unit
                quantity.
              </div>
            )}
          </motion.div>

          {/* RIGHT: LIVE RESULTS */}

          <div className="min-w-0 space-y-5">
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={ENTER_TRANSITION}
              className="rounded-2xl border border-[#D7E0EB] bg-white p-5 shadow-sm sm:p-6"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-[#EDF3FA] p-3 text-[#193B66]">
                  <BarChart3 size={22} />
                </div>

                <div>
                  <h3 className="text-lg font-bold text-[#25334A]">
                    Revenue vs. costs
                  </h3>

                  <p className="mt-1 text-sm text-[#61738B]">
                    Monthly financial comparison
                  </p>
                </div>
              </div>

              {isValid ? (
                <div className="mt-5">
                  <RevenueCostChart
                    financials={financials}
                  />

                  <div className="mt-3 rounded-xl bg-[#F5F8FC] p-4">
                    <p className="text-xs text-[#61738B]">
                      Estimated monthly profit / loss
                    </p>

                    <p
                      className={`mt-2 text-2xl font-bold ${
                        financials.profit < 0
                          ? "text-red-700"
                          : "text-[#13795B]"
                      }`}
                    >
                      {money(financials.profit)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-6 text-sm text-[#61738B]">
                  Enter valid assumptions to view
                  the financial chart.
                </p>
              )}
            </motion.section>

            <section className="rounded-2xl border border-[#D7E0EB] bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-[#EAF6F0] p-3 text-[#13795B]">
                  <Calculator size={22} />
                </div>

                <h3 className="text-lg font-bold text-[#25334A]">
                  Financial details
                </h3>
              </div>

              <div className="mt-5">
                <DetailRow
                  label="Revenue"
                  value={
                    isValid
                      ? money(financials.revenue)
                      : "—"
                  }
                />

                <DetailRow
                  label="Total variable costs"
                  value={
                    isValid
                      ? money(financials.totalCosts)
                      : "—"
                  }
                />

                <DetailRow
                  label="Estimated profit"
                  value={
                    isValid
                      ? money(financials.profit)
                      : "—"
                  }
                  highlight={
                    isValid && financials.profit >= 0
                  }
                  negative={
                    isValid && financials.profit < 0
                  }
                />

                <DetailRow
                  label="Profit margin"
                  value={
                    isValid
                      ? percent(financials.margin)
                      : "—"
                  }
                />

                <DetailRow
                  label="Return on investment"
                  value={
                    isValid
                      ? financials.roi === null
                        ? "N/A"
                        : percent(financials.roi)
                      : "—"
                  }
                />

                <DetailRow
                  label="Contribution per unit"
                  value={
                    isValid
                      ? money(
                          financials.contributionPerUnit
                        )
                      : "—"
                  }
                />

                <DetailRow
                  label="Break-even units"
                  value={
                    !isValid
                      ? "—"
                      : financials.contributionPerUnit > 0
                        ? "0 (no fixed costs)"
                        : "Not reachable"
                  }
                />
              </div>

              <p className="mt-5 text-xs leading-6 text-[#61738B]">
                These are illustrative financial
                calculations, not model-generated sales
                forecasts. Fixed costs are excluded.
              </p>
            </section>
          </div>
        </div>
      </section>

      {/* ====================================
          COST BREAKDOWN
      ==================================== */}

      {isValid && (
        <div className="mt-6">
          <CostBreakdown values={values} />
        </div>
      )}

      {/* ====================================
          BASELINE COMPARISON
      ==================================== */}

      <section className="mt-10">
        <SectionHeading
          eyebrow="Scenario comparison"
          title="Original vs. adjusted price"
          description="Compare financial results at the original product price and your proposed selling price."
        />

        <div className="mt-5 flex items-start gap-3 rounded-xl border border-[#D7E0EB] bg-white p-4">
          <Info
            size={18}
            className="mt-0.5 shrink-0 text-[#193B66]"
          />

          <p className="text-xs leading-6 text-[#61738B]">
            Both scenarios use the same current monthly
            sales volume and per-unit cost assumptions.
            Only the selling price differs. This isolates
            the arithmetic effect of a price change;
            it does not predict how demand responds.
          </p>
        </div>

        {isValid && baseline ? (
          <>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <ComparisonCard
                label="Monthly revenue"
                original={baseline.revenue}
                current={financials.revenue}
              />

              <ComparisonCard
                label="Monthly profit"
                original={baseline.profit}
                current={financials.profit}
              />

              <ComparisonCard
                label="Profit margin"
                original={baseline.margin}
                current={financials.margin}
                format={percent}
              />
            </div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-5 flex flex-col justify-between gap-4 rounded-2xl bg-gradient-to-r from-[#193B66] to-[#275788] p-6 text-white sm:flex-row sm:items-center"
            >
              <div>
                <p className="text-sm text-[#DCE8F5]">
                  Current selling price adjustment
                </p>

                <p className="mt-2 text-3xl font-bold">
                  {signedPercent(priceDifference)}
                </p>
              </div>

              <div className="text-left sm:text-right">
                <p className="text-sm text-[#DCE8F5]">
                  Original price
                </p>

                <p className="mt-1 text-lg font-bold">
                  {money(originalPrice)}
                </p>

                <p className="mt-3 text-sm text-[#DCE8F5]">
                  Proposed price
                </p>

                <p className="mt-1 text-lg font-bold text-[#FFD45A]">
                  {money(values.price)}
                </p>
              </div>
            </motion.div>
          </>
        ) : (
          <div className="mt-6 rounded-2xl border border-[#D7E0EB] bg-white p-6 text-sm text-[#61738B]">
            Valid assumptions and an original product
            price are required for comparison.
          </div>
        )}
      </section>

      {/* ====================================
          AI PRICE SIMULATION
      ==================================== */}

      <AIPriceSimulation
        product={product}
        prediction={prediction}
        values={values}
        isValid={isValid}
        loading={loading}
        error={error}
        rescore={rescore}
        simulations={simulations}
        onRun={runSimulation}
      />
    </main>
  );
}
