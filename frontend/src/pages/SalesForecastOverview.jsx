
import { useState } from "react";
import { Link } from "react-router-dom";
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

import useDialogFocus from "../hooks/useDialogFocus";

// ========================================
// THEME
// ========================================

const COLORS = {
  navy: "#193B66",
  gold: "#D4A529",
  green: "#13795B",
  slate: "#8FA4BA",
  muted: "#61738B",
};

const CATEGORIES = [
  {
    id: "pricing",
    label: "Pricing",
    description: "Selling price and its estimated range.",
    color: "#D4A529",
    background: "#FFF8E5",
  },
  {
    id: "demand",
    label: "Demand",
    description: "Market demand and category demand share.",
    color: "#193B66",
    background: "#F1F6FC",
  },
  {
    id: "returns",
    label: "Returns",
    description: "Return on investment estimates.",
    color: "#13795B",
    background: "#F0F8F4",
  },
];

// ========================================
// FORMATTING HELPERS
// ========================================

function numberOrNull(value) {
  if (
    value == null ||
    value === "" ||
    !Number.isFinite(Number(value))
  ) {
    return null;
  }

  return Number(value);
}

function getValue(metric) {
  return numberOrNull(metric?.value);
}

function formatNumber(value) {
  const number = numberOrNull(value);

  if (number === null) return "—";

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(number);
}

function formatCurrency(value) {
  const number = numberOrNull(value);

  if (number === null) return "—";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(number);
}

function formatCompact(value) {
  const number = numberOrNull(value);

  if (number === null) return "—";

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(number);
}

function formatMetric(metric) {
  const value = getValue(metric);

  if (value === null) return "—";

  if (metric.unit === "USD") {
    return formatCurrency(value);
  }

  if (metric.unit === "%") {
    return `${value.toFixed(2)}%`;
  }

  return formatNumber(value);
}

function validRange(metric) {
  const value = getValue(metric);
  const range = metric?.range;

  if (
    value === null ||
    !Array.isArray(range) ||
    range.length !== 2
  ) {
    return null;
  }

  const low = numberOrNull(range[0]);
  const high = numberOrNull(range[1]);

  if (
    low === null ||
    high === null ||
    low > high ||
    value < low ||
    value > high
  ) {
    return null;
  }

  return [low, high];
}

function formatPeriod(period) {
  if (period == null) {
    return "Unavailable";
  }

  const text = String(period);

  if (/^\d{4}-\d{2}$/.test(text)) {
    const [year, month] = text.split("-").map(Number);

    if (month >= 1 && month <= 12) {
      return new Intl.DateTimeFormat("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(
        new Date(Date.UTC(year, month - 1, 1))
      );
    }
  }

  return text;
}

// ========================================
// SHARED SECTION HEADING
// ========================================

function SectionHeading({
  eyebrow,
  title,
  description,
}) {
  return (
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
  );
}

// ========================================
// ESTIMATED RANGE TEXT
// ========================================

function RangeText({ metric, light = false }) {
  const range = validRange(metric);

  const color = light
    ? "text-white/75"
    : "text-[#61738B]";

  if (!range) {
    return metric?.range ? (
      <p className={`mt-3 text-xs ${color}`}>
        Estimated range unavailable
      </p>
    ) : null;
  }

  return (
    <p className={`mt-3 text-xs leading-5 ${color}`}>
      Estimated range:{" "}
      {formatMetric({
        value: range[0],
        unit: metric.unit,
      })}
      {" – "}
      {formatMetric({
        value: range[1],
        unit: metric.unit,
      })}
    </p>
  );
}

// ========================================
// PRIMARY KPI CARDS
// ========================================

function HeroMetric({
  label,
  metric,
  subtitle,
  variant = "revenue",
}) {
  const variants = {
    revenue: {
      background:
        "linear-gradient(135deg, #193B66, #244B7B)",
      text: "text-white",
      muted: "text-[#D2DFED]",
      badge: "bg-white/10 text-[#FFD45A]",
      badgeLabel: "REVENUE",
    },

    units: {
      background:
        "linear-gradient(135deg, #F6C94D, #F9DD86)",
      text: "text-[#25334A]",
      muted: "text-[#6C5528]",
      badge: "bg-white/40 text-[#705211]",
      badgeLabel: "SALES VOLUME",
    },

    profit: {
      background:
        "linear-gradient(135deg, #11684F, #219674)",
      text: "text-white",
      muted: "text-[#D6F3E9]",
      badge: "bg-white/15 text-[#E1FFF2]",
      badgeLabel: "PROFIT",
    },
  };

  const style = variants[variant] || variants.revenue;

  return (
    <article
      className="relative flex min-h-[230px] min-w-0 flex-col justify-between overflow-hidden rounded-2xl border border-white/10 p-6 shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl motion-reduce:transition-none"
      style={{ background: style.background }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-12 -top-14 h-48 w-48 rounded-full border-[32px] border-white/10"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -left-16 h-44 w-44 rounded-full bg-white/5"
      />

      <div className="relative z-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className={`text-sm font-semibold ${style.muted}`}>
            {label}
          </p>

          <span
            className={`rounded-full px-3 py-1 text-[10px] font-bold tracking-wide ${style.badge}`}
          >
            {style.badgeLabel}
          </span>
        </div>

        <p
          className={`mt-7 break-words text-[clamp(1.75rem,2.8vw,2.5rem)] font-bold leading-tight tracking-tight ${style.text}`}
        >
          {formatMetric(metric)}
        </p>

        <p className={`mt-3 text-sm ${style.muted}`}>
          {subtitle}
        </p>
      </div>

      <div className="relative z-10 mt-3">
        <RangeText metric={metric} light />
      </div>
    </article>
  );
}

// ========================================
// CHART CONTAINER
// ========================================

function ChartCard({
  title,
  description,
  children,
}) {
  return (
    <article className="min-w-0 rounded-2xl border border-[#D7E0EB] bg-white p-5 shadow-sm sm:p-6">
      <h3 className="text-lg font-bold text-[#25334A]">
        {title}
      </h3>

      <p className="mt-2 text-sm leading-6 text-[#61738B]">
        {description}
      </p>

      <div className="mt-6">{children}</div>
    </article>
  );
}

// ========================================
// RECHARTS TOOLTIP
// ========================================

function CustomTooltip({
  active,
  payload,
  currency = false,
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const entry = payload[0];

  return (
    <div className="rounded-xl border border-[#D7E0EB] bg-white px-4 py-3 shadow-xl">
      <p className="text-sm font-semibold text-[#25334A]">
        {entry.payload?.name || entry.name}
      </p>

      <p className="mt-1 text-sm font-medium text-[#193B66]">
        {currency
          ? formatCurrency(entry.value)
          : formatNumber(entry.value)}
      </p>
    </div>
  );
}

// ========================================
// REVENUE VS. COSTS CHART
// ========================================

function FinancialChart({ predictions }) {
  const revenue = getValue(predictions?.gross_revenue);
  const profit = getValue(predictions?.net_profit);

  const costs =
    revenue !== null && profit !== null
      ? revenue - profit
      : null;

  if (
    revenue === null ||
    profit === null ||
    costs === null ||
    revenue < 0 ||
    costs < 0
  ) {
    return (
      <p className="py-10 text-sm text-[#61738B]">
        Financial comparison unavailable.
      </p>
    );
  }

  const data = [
    {
      name: "Revenue",
      value: revenue,
      color: COLORS.gold,
    },
    {
      name: "Costs",
      value: costs,
      color: COLORS.slate,
    },
  ];

  return (
    <>
      <div
        className="h-[260px] w-full"
        role="img"
        aria-label={`Revenue ${formatCurrency(
          revenue
        )}; estimated costs ${formatCurrency(costs)}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{
              top: 12,
              right: 14,
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
              width={65}
              tick={{
                fill: COLORS.muted,
                fontSize: 11,
              }}
              tickFormatter={(value) =>
                `$${formatCompact(value)}`
              }
            />

            <Tooltip
              content={<CustomTooltip currency />}
              cursor={{ fill: "#F5F7FA" }}
            />

            <Bar
              dataKey="value"
              maxBarSize={92}
              radius={[8, 8, 0, 0]}
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

      <div className="mt-5 rounded-xl bg-[#F5F8FC] p-4">
        <p className="text-xs text-[#61738B]">
          Estimated net profit / loss
        </p>

        <p
          className={`mt-2 text-2xl font-bold ${
            profit < 0
              ? "text-red-700"
              : "text-[#193B66]"
          }`}
        >
          {formatCurrency(profit)}
        </p>
      </div>
    </>
  );
}

// ========================================
// SALES VS. DEMAND CHART
// ========================================

function DemandChart({ predictions }) {
  const units = getValue(predictions?.units_sold);
  const demand = getValue(predictions?.demand_units);

  if (
    units === null ||
    demand === null ||
    units < 0 ||
    demand < 0
  ) {
    return (
      <p className="py-10 text-sm text-[#61738B]">
        Sales and demand comparison unavailable.
      </p>
    );
  }

  const data = [
    {
      name: "Sales",
      value: units,
      color: COLORS.gold,
    },
    {
      name: "Demand",
      value: demand,
      color: COLORS.navy,
    },
  ];

  return (
    <>
      <div
        className="h-[260px] w-full"
        role="img"
        aria-label={`Sales ${formatNumber(
          units
        )}; demand ${formatNumber(demand)}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{
              top: 10,
              right: 28,
              bottom: 0,
              left: 0,
            }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              horizontal={false}
              stroke="#EDF1F5"
            />

            <XAxis
              type="number"
              domain={[0, "auto"]}
              axisLine={false}
              tickLine={false}
              tick={{
                fill: COLORS.muted,
                fontSize: 11,
              }}
              tickFormatter={formatCompact}
            />

            <YAxis
              type="category"
              dataKey="name"
              width={65}
              axisLine={false}
              tickLine={false}
              tick={{
                fill: COLORS.muted,
                fontSize: 12,
              }}
            />

            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: "#F5F7FA" }}
            />

            <Bar
              dataKey="value"
              maxBarSize={58}
              radius={[0, 8, 8, 0]}
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

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-[#FFF8E5] p-4">
          <p className="text-xs text-[#8B6B1E]">
            Predicted sales
          </p>

          <p className="mt-2 text-xl font-bold text-[#25334A]">
            {formatNumber(units)}
          </p>
        </div>

        <div className="rounded-xl bg-[#F1F6FC] p-4">
          <p className="text-xs text-[#61738B]">
            Estimated demand
          </p>

          <p className="mt-2 text-xl font-bold text-[#25334A]">
            {formatNumber(demand)}
          </p>
        </div>
      </div>
    </>
  );
}

// ========================================
// MINI TABS
// ========================================

function MiniTabs({
  value,
  onChange,
  options,
  label,
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex rounded-xl bg-[#F1F5F9] p-1"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all duration-200 ${
            value === option.value
              ? "bg-white text-[#193B66] shadow-sm"
              : "text-[#61738B] hover:text-[#25334A]"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

// ========================================
// SHARED 3D FLIP CARD
// ========================================

function FlipCard({
  flipped,
  front,
  back,
  height = "390px",
}) {
  return (
    <div
      className="w-full"
      style={{ perspective: "1400px" }}
    >
      <div
        className="relative w-full transition-transform duration-700 ease-in-out motion-reduce:transition-none"
        style={{
          height,
          transformStyle: "preserve-3d",
          transform: flipped
            ? "rotateY(180deg)"
            : "rotateY(0deg)",
        }}
      >
        <div
          className="absolute inset-0 w-full overflow-y-auto rounded-2xl"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
          }}
          aria-hidden={flipped}
          inert={flipped}
        >
          {front}
        </div>

        <div
          className="absolute inset-0 w-full overflow-y-auto rounded-2xl"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
          aria-hidden={!flipped}
          inert={!flipped}
        >
          {back}
        </div>
      </div>
    </div>
  );
}

// ========================================
// PROFITABILITY FLIP PANEL
// ========================================

function ProfitabilityPanel({ predictions }) {
  const [view, setView] = useState("margin");

  const margin = getValue(predictions?.profit_margin_pct);
  const roi = getValue(predictions?.roi_cum_pct);

  const barWidth =
    margin === null
      ? 0
      : Math.max(0, Math.min(100, margin));

  const front = (
    <div className="h-full rounded-2xl bg-gradient-to-br from-[#F4FAF7] to-[#EAF5EF] p-5 sm:p-6">
      <p className="text-xs font-bold uppercase tracking-wider text-[#547566]">
        Predicted profit margin
      </p>

      <p
        className={`mt-5 text-4xl font-bold ${
          margin !== null && margin < 0
            ? "text-red-700"
            : "text-[#13795B]"
        }`}
      >
        {margin === null
          ? "—"
          : `${margin.toFixed(2)}%`}
      </p>

      <RangeText metric={predictions?.profit_margin_pct} />

      <div className="mt-8">
        <div
          className="h-4 overflow-hidden rounded-full bg-[#DCE8E2]"
          role="progressbar"
          aria-label="Predicted profit margin"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={barWidth}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#D4A529] to-[#15966E] transition-all duration-500"
            style={{ width: `${barWidth}%` }}
          />
        </div>

        <div className="mt-3 flex justify-between text-xs text-[#61738B]">
          <span>0%</span>
          <span>100%</span>
        </div>
      </div>

      <div className="mt-8 rounded-xl bg-white/80 p-4">
        <p className="text-xs text-[#61738B]">
          Profitability
        </p>

        <p className="mt-2 text-lg font-semibold text-[#25334A]">
          {margin === null
            ? "Unavailable"
            : margin > 0
              ? "Positive margin"
              : margin < 0
                ? "Negative margin"
                : "Break-even margin"}
        </p>
      </div>
    </div>
  );

  const back = (
    <div className="relative h-full overflow-hidden rounded-2xl bg-gradient-to-br from-[#193B66] to-[#275788] p-5 text-white sm:p-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-14 -top-16 h-52 w-52 rounded-full border-[35px] border-white/5"
      />

      <div className="relative z-10">
        <p className="text-xs font-bold uppercase tracking-wider text-[#FFD45A]">
          Cumulative return on investment
        </p>

        <p className="mt-8 break-words text-4xl font-bold">
          {roi === null
            ? "—"
            : `${roi.toFixed(2)}%`}
        </p>

        <RangeText metric={predictions?.roi_cum_pct} light />

        <div className="mt-8 rounded-xl border border-white/15 bg-white/10 p-5">
          <p className="text-xs text-slate-200">
            ROI expressed as a ratio
          </p>

          <p className="mt-2 text-2xl font-bold text-white">
            {roi === null
              ? "—"
              : `${(roi / 100).toFixed(2)}×`}
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <section className="min-w-0 rounded-2xl border border-[#D7E0EB] bg-white p-6 shadow-sm">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.13em] text-[#A77E1C]">
            Profitability
          </p>

          <h3 className="mt-2 text-lg font-bold text-[#25334A]">
            Financial efficiency
          </h3>

          <p className="mt-2 text-sm text-[#61738B]">
            Profitability performance
          </p>
        </div>

        <MiniTabs
          label="Profitability metric"
          value={view}
          onChange={setView}
          options={[
            { label: "Margin", value: "margin" },
            { label: "ROI", value: "roi" },
          ]}
        />
      </div>

      <div className="mt-7">
        <FlipCard
          flipped={view === "roi"}
          front={front}
          back={back}
        />
      </div>
    </section>
  );
}

// ========================================
// DEMAND DIRECTION FLIP PANEL
// ========================================

function DemandDirectionPanel({
  timeframe,
  selectedForecast,
  predictions,
}) {
  const [view, setView] = useState("trend");

  const trend =
    timeframe === "monthly"
      ? selectedForecast?.demand_trend
      : selectedForecast?.demand_change_yoy;

  const previousDemand = numberOrNull(
    timeframe === "monthly"
      ? trend?.last_month_demand
      : trend?.last_year_demand
  );

  const forecastDemand = getValue(
    predictions?.demand_units
  );

  const comparable =
    previousDemand !== null &&
    forecastDemand !== null &&
    previousDemand >= 0 &&
    forecastDemand >= 0;

  const difference = comparable
    ? forecastDemand - previousDemand
    : null;

  const percentChange =
    comparable && previousDemand > 0
      ? (difference / previousDemand) * 100
      : null;

  const direction = String(
    trend?.direction || "Unavailable"
  );

  const normalized = direction.toLowerCase();

  const positive = /up|increase|grow/.test(normalized);
  const negative = /down|decrease|decline|fall/.test(
    normalized
  );

  const tone = positive
    ? "bg-green-50 text-green-700"
    : negative
      ? "bg-red-50 text-red-700"
      : "bg-slate-100 text-[#193B66]";

  const data = comparable
    ? [
        {
          name:
            timeframe === "monthly"
              ? "Previous month"
              : "Previous year",
          value: previousDemand,
          color: COLORS.slate,
        },
        {
          name: "Forecast",
          value: forecastDemand,
          color: COLORS.green,
        },
      ]
    : [];

  const front = (
    <div className="h-full rounded-2xl bg-gradient-to-br from-[#F5F8FC] to-[#EDF3FA] p-5 sm:p-6">
      <p className="text-xs font-bold uppercase tracking-wider text-[#61738B]">
        Model-indicated trend
      </p>

      <div className="mt-7 flex items-center gap-4">
        <div
          className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-4xl font-bold ${tone}`}
          aria-hidden="true"
        >
          {positive ? "↗" : negative ? "↘" : "→"}
        </div>

        <div>
          <p className="text-3xl font-bold capitalize text-[#25334A]">
            {direction}
          </p>

          <p className="mt-2 text-xs text-[#61738B]">
            {timeframe === "monthly"
              ? "Monthly demand"
              : "Yearly demand"}
          </p>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs text-[#61738B]">
            Previous demand
          </p>

          <p className="mt-3 text-xl font-bold text-[#25334A]">
            {formatNumber(previousDemand)}
          </p>
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs text-[#61738B]">
            Forecast demand
          </p>

          <p className="mt-3 text-xl font-bold text-[#25334A]">
            {formatNumber(forecastDemand)}
          </p>
        </div>
      </div>

      {timeframe === "yearly" &&
        numberOrNull(trend?.value) !== null && (
          <div className="mt-5 rounded-xl bg-white p-4">
            <p className="text-xs text-[#61738B]">
              Year-over-year change
            </p>

            <p className="mt-2 text-xl font-bold text-[#25334A]">
              {Number(trend.value).toFixed(2)}%
            </p>
          </div>
        )}
    </div>
  );

  const back = (
    <div className="h-full rounded-2xl bg-gradient-to-br from-[#F4FAF7] to-[#EAF5EF] p-4 sm:p-5">
      <p className="text-xs font-bold uppercase tracking-wider text-[#13795B]">
        Demand comparison
      </p>

      {comparable ? (
        <>
          <div
            className="mt-3 h-[220px] w-full"
            role="img"
            aria-label={`Previous demand ${formatNumber(
              previousDemand
            )}; forecast demand ${formatNumber(
              forecastDemand
            )}`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                layout="vertical"
                margin={{
                  top: 12,
                  right: 20,
                  bottom: 0,
                  left: 0,
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  stroke="#DCE9E2"
                />

                <XAxis
                  type="number"
                  domain={[0, "auto"]}
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: COLORS.muted,
                    fontSize: 11,
                  }}
                  tickFormatter={formatCompact}
                />

                <YAxis
                  type="category"
                  dataKey="name"
                  width={105}
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: COLORS.muted,
                    fontSize: 11,
                  }}
                />

                <Tooltip content={<CustomTooltip />} />

                <Bar
                  dataKey="value"
                  maxBarSize={45}
                  radius={[0, 8, 8, 0]}
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

          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-xs text-[#61738B]">
              Demand difference
            </p>

            <p
              className={`mt-2 text-2xl font-bold ${
                difference < 0
                  ? "text-red-700"
                  : "text-[#13795B]"
              }`}
            >
              {difference > 0 ? "+" : ""}
              {formatNumber(difference)} units
            </p>

            {percentChange !== null && (
              <p className="mt-1 text-sm text-[#61738B]">
                {percentChange > 0 ? "+" : ""}
                {percentChange.toFixed(2)}%
              </p>
            )}
          </div>
        </>
      ) : (
        <p className="mt-8 text-sm text-[#61738B]">
          Demand comparison unavailable.
        </p>
      )}
    </div>
  );

  return (
    <section className="min-w-0 rounded-2xl border border-[#D7E0EB] bg-white p-6 shadow-sm">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.13em] text-[#A77E1C]">
            Demand intelligence
          </p>

          <h3 className="mt-2 text-lg font-bold text-[#25334A]">
            Demand direction
          </h3>

          <p className="mt-2 text-sm text-[#61738B]">
            Market demand performance
          </p>
        </div>

        <MiniTabs
          label="Demand display"
          value={view}
          onChange={setView}
          options={[
            { label: "Trend", value: "trend" },
            { label: "Compare", value: "compare" },
          ]}
        />
      </div>

      <div className="mt-7">
        <FlipCard
          flipped={view === "compare"}
          front={front}
          back={back}
        />
      </div>
    </section>
  );
}

// ========================================
// SUPPORTING METRICS RANGE VISUALIZATION
// ========================================

function RangeVisualization({ metric, color }) {
  const value = getValue(metric);
  const range = validRange(metric);

  if (!range) {
    return (
      <p className="text-sm text-[#61738B]">
        Estimated range unavailable.
      </p>
    );
  }

  const [low, high] = range;
  const span = high - low;

  const position =
    span === 0
      ? 50
      : Math.max(
          0,
          Math.min(100, ((value - low) / span) * 100)
        );

  const formatBound = (number) =>
    formatMetric({
      value: number,
      unit: metric.unit,
    });

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-wide text-[#61738B]">
          Estimated interval
        </p>

        <span
          className="rounded-full px-3 py-1 text-xs font-bold"
          style={{
            backgroundColor: `${color}15`,
            color,
          }}
        >
          {formatBound(value)}
        </span>
      </div>

      <div
        className="relative mt-8 h-3 rounded-full bg-[#E7EDF3]"
        role="img"
        aria-label={`Lower ${formatBound(
          low
        )}, prediction ${formatBound(
          value
        )}, upper ${formatBound(high)}`}
      >
        <div
          className="absolute inset-0 rounded-full opacity-25"
          style={{ backgroundColor: color }}
        />

        <div
          className="absolute top-1/2 z-10 h-6 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md"
          style={{
            left: `${position}%`,
            backgroundColor: color,
          }}
        />
      </div>

      <div className="mt-5 flex justify-between gap-4 text-xs">
        <div>
          <p className="text-[#61738B]">
            Lower estimate
          </p>

          <p className="mt-1 font-bold text-[#25334A]">
            {formatBound(low)}
          </p>
        </div>

        <div className="text-right">
          <p className="text-[#61738B]">
            Upper estimate
          </p>

          <p className="mt-1 font-bold text-[#25334A]">
            {formatBound(high)}
          </p>
        </div>
      </div>
    </div>
  );
}

// ========================================
// EXPANDABLE SUPPORTING METRIC CARD
// ========================================

function SupportingMetricCard({
  id,
  label,
  metric,
  description,
  color,
  background,
  featured = false,
}) {
  const [expanded, setExpanded] = useState(false);

  const range = validRange(metric);

  return (
    <article
      className="w-full max-w-[900px] min-w-0 overflow-hidden rounded-2xl border border-[#D7E0EB] shadow-sm transition-shadow duration-300 hover:shadow-md"
      style={{
        background: featured
          ? "linear-gradient(120deg, #193B66, #275788)"
          : "#FFFFFF",
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((previous) => !previous)}
        aria-expanded={expanded}
        aria-controls={`supporting-details-${id}`}
        className="flex w-full items-start justify-between gap-4 p-5 text-left sm:p-6"
      >
        <div className="min-w-0">
          <p
            className={`text-sm font-medium ${
              featured
                ? "text-slate-200"
                : "text-[#61738B]"
            }`}
          >
            {label}
          </p>

          <p
            className={`mt-3 break-words text-3xl font-bold tracking-tight ${
              featured
                ? "text-white"
                : "text-[#25334A]"
            }`}
          >
            {formatMetric(metric)}
          </p>

          <p
            className={`mt-3 text-xs ${
              featured
                ? "text-slate-200"
                : "text-[#61738B]"
            }`}
          >
            {range
              ? `Estimated range: ${formatMetric({
                  value: range[0],
                  unit: metric.unit,
                })} – ${formatMetric({
                  value: range[1],
                  unit: metric.unit,
                })}`
              : "Estimated range unavailable"}
          </p>
        </div>

        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl transition-transform duration-300 ${
            expanded ? "rotate-180" : ""
          } ${
            featured
              ? "bg-white/15 text-[#FFD45A]"
              : "bg-[#EEF4F7] text-[#193B66]"
          }`}
          aria-hidden="true"
        >
          ⌄
        </span>
      </button>

      <div
        id={`supporting-details-${id}`}
        className={`grid transition-[grid-template-rows,opacity] duration-300 motion-reduce:transition-none ${
          expanded
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0"
        }`}
        inert={!expanded}
        aria-hidden={!expanded}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className="mx-5 mb-5 rounded-xl p-5 sm:mx-6 sm:mb-6"
            style={{
              backgroundColor: featured
                ? "#FFFFFF"
                : background,
            }}
          >
            <p className="mb-5 text-sm leading-6 text-[#61738B]">
              {description}
            </p>

            <RangeVisualization
              metric={metric}
              color={color}
            />
          </div>
        </div>
      </div>
    </article>
  );
}

// ========================================
// CATEGORY PANEL CONTENT
// ========================================

function SupportingCategoryContent({
  category,
  predictions,
  timeframe,
}) {
  const activeCategory =
    CATEGORIES.find((item) => item.id === category) ||
    CATEGORIES[0];

  const metrics = {
    pricing: [
      {
        id: "price",
        label: "Average selling price",
        metric: predictions?.avg_price,
        description:
          "Predicted average selling price for the selected forecast period.",
      },
    ],

    demand: [
      {
        id: "demand",
        label: "Estimated demand",
        metric: predictions?.demand_units,
        description:
          "Demand quantity estimated by the forecasting model.",
      },
      {
        id: "share",
        label: "Share of category demand",
        metric: predictions?.demand_share_pct,
        description:
          "Estimated percentage of category demand attributed to this product.",
      },
    ],

    returns: [
      {
        id: "period-roi",
        label:
          timeframe === "yearly"
            ? "Annual return on investment"
            : "Return on investment per unit",
        metric:
          timeframe === "yearly"
            ? predictions?.roi_year_pct
            : predictions?.roi_unit_pct,
        description:
          timeframe === "yearly"
            ? "Annual ROI estimated by the forecasting model."
            : "Estimated return on investment per unit.",
      },
      {
        id: "cumulative-roi",
        label: "Cumulative return on investment",
        metric: predictions?.roi_cum_pct,
        description:
          "Cumulative return on investment reported by the model.",
        featured: true,
      },
    ],
  };

  return (
    <div
      className="flex h-full min-h-[490px] flex-col rounded-2xl border border-[#D7E0EB] p-5 sm:p-6"
      style={{
        backgroundColor: activeCategory.background,
      }}
    >
      <div className="flex items-center gap-3">
        <span
          className="h-3 w-3 shrink-0 rounded-full"
          style={{
            backgroundColor: activeCategory.color,
          }}
        />

        <div>
          <h3 className="font-bold text-[#25334A]">
            {activeCategory.label} insights
          </h3>

          <p className="mt-1 text-sm text-[#61738B]">
            {activeCategory.description}
          </p>
        </div>
      </div>

      <div className="my-auto flex flex-col items-center gap-4 py-6">
        {metrics[category].map((item) => (
          <SupportingMetricCard
            key={`${category}-${item.id}`}
            {...item}
            color={activeCategory.color}
            background={activeCategory.background}
          />
        ))}
      </div>
    </div>
  );
}

// ========================================
// ENTIRE SUPPORTING METRICS PANEL FLIP
// ========================================

function SupportingMetrics({
  predictions,
  timeframe,
}) {
  const [category, setCategory] = useState("pricing");

  const [nextCategory, setNextCategory] = useState(null);

  const [flipped, setFlipped] = useState(false);

  function selectCategory(newCategory) {
    if (
      newCategory === category ||
      nextCategory !== null
    ) {
      return;
    }

    // Skip the animation for users who prefer
    // reduced motion.
    if (
      window.matchMedia?.(
        "(prefers-reduced-motion: reduce)"
      ).matches
    ) {
      setCategory(newCategory);
      return;
    }

    setNextCategory(newCategory);
    setFlipped(true);
  }

  function finishFlip(event) {
    if (
      event.target !== event.currentTarget ||
      event.propertyName !== "transform" ||
      !flipped ||
      nextCategory === null
    ) {
      return;
    }

    // The selected category is now visible.
    // Make it the permanent front face without
    // animating the reset.
    setCategory(nextCategory);
    setNextCategory(null);
    setFlipped(false);
  }

  const selectedCategory = nextCategory ?? category;

  return (
    <section className="mt-10">
      {/* STATIONARY HEADING AND CATEGORY TABS */}

      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <SectionHeading
          eyebrow="Additional insights"
          title="Supporting metrics"
          description="Explore pricing, demand, and returns in more detail."
        />

        <div
          role="group"
          aria-label="Supporting metric category"
          className="inline-flex w-fit flex-wrap gap-1 rounded-xl border border-[#D7E0EB] bg-white p-1 shadow-sm"
        >
          {CATEGORIES.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={nextCategory !== null}
              onClick={() => selectCategory(item.id)}
              aria-pressed={selectedCategory === item.id}
              className={`rounded-lg px-4 py-3 text-sm font-semibold transition-colors disabled:cursor-default ${
                selectedCategory === item.id
                  ? "bg-[#193B66] text-white shadow-sm"
                  : "text-[#61738B] hover:bg-[#F5F8FC]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3D PERSPECTIVE SCENE */}

      <div
        className="mt-6 w-full"
        style={{
          perspective: "1600px",
        }}
      >
        {/* ROTATING INSIGHTS WINDOW */}

        <div
          className="grid w-full"
          onTransitionEnd={finishFlip}
          style={{
            transformStyle: "preserve-3d",
            transform: flipped
              ? "rotateY(180deg)"
              : "rotateY(0deg)",
            transition: flipped
              ? "transform 700ms cubic-bezier(0.22, 1, 0.36, 1)"
              : "none",
          }}
        >
          {/* FRONT FACE: CURRENT CATEGORY */}

          <div
            className="min-w-0"
            style={{
              gridArea: "1 / 1",
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
            }}
            aria-hidden={flipped}
            inert={flipped}
          >
            <SupportingCategoryContent
              category={category}
              predictions={predictions}
              timeframe={timeframe}
            />
          </div>

          {/* BACK FACE: NEXT CATEGORY */}

          <div
            className="min-w-0"
            style={{
              gridArea: "1 / 1",
              transform: "rotateY(180deg)",
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
            }}
            aria-hidden={!flipped}
            inert={!flipped}
          >
            {nextCategory ? (
              <SupportingCategoryContent
                category={nextCategory}
                predictions={predictions}
                timeframe={timeframe}
              />
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

// ========================================
// FORECAST DETAILS ICONS
// ========================================

function DetailIcon({ name }) {
  const paths = {
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 3v4M17 3v4M3 10h18" />
      </>
    ),

    chart: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <path d="M7 16v-3M12 16V8M17 16v-5" />
      </>
    ),

    percent: (
      <>
        <circle cx="7" cy="7" r="2" />
        <circle cx="17" cy="17" r="2" />
        <path d="M5 19 19 5" />
      </>
    ),

    history: (
      <>
        <path d="M3 12a9 9 0 1 0 2.6-6.4L3 8" />
        <path d="M3 3v5h5M12 7v5l3 2" />
      </>
    ),
  };

  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.chart}
    </svg>
  );
}

// ========================================
// FORECAST DETAILS
// ========================================

function ForecastDetails({
  timeframe,
  selectedForecast,
  period,
}) {
  const details = [
    {
      icon: "chart",
      label: "Forecast type",
      value:
        timeframe === "monthly"
          ? "Monthly"
          : "Yearly",
      color: "text-[#193B66]",
      background: "bg-[#EBF2FA]",
    },

    {
      icon: "calendar",
      label: "Forecast period",
      value: formatPeriod(period),
      color: "text-[#A77E1C]",
      background: "bg-[#FFF6DD]",
    },
  ];

  if (timeframe === "monthly") {
    details.push(
      {
        icon: "percent",
        label: "Expected promotion discount",
        value:
          selectedForecast?.promo_depth_pct != null
            ? `${selectedForecast.promo_depth_pct}%`
            : "Unavailable",
        color: "text-[#13795B]",
        background: "bg-[#EAF6F0]",
      },

      {
        icon: "history",
        label: "Promotion assumption",
        value:
          selectedForecast?.promo_source ||
          "Unavailable",
        color: "text-[#7658A8]",
        background: "bg-[#F2EDFA]",
      }
    );
  }

  return (
    <section className="mt-9 rounded-2xl border border-[#D7E0EB] bg-white p-6 shadow-sm">
      <SectionHeading
        eyebrow="Forecast context"
        title="Forecast details"
        description="Period information and model assumptions."
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {details.map((detail) => (
          <div
            key={detail.label}
            className="flex min-w-0 items-start gap-4 rounded-xl border border-[#E6EDF4] bg-[#FAFCFE] p-4 transition-colors hover:bg-[#F5F8FC]"
          >
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${detail.background} ${detail.color}`}
            >
              <DetailIcon name={detail.icon} />
            </div>

            <div className="min-w-0">
              <p className="text-xs font-medium text-[#61738B]">
                {detail.label}
              </p>

              <p className="mt-2 break-words text-base font-bold text-[#25334A]">
                {detail.value}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ========================================
// FLOATING FORECAST INFORMATION
// ========================================

function AboutForecast({ notes }) {
  const [open, setOpen] = useState(false);
  const dialogRef = useDialogFocus(open, () => setOpen(false));

  return (
    <>
      {/* FLOATING BUTTON */}

      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="About this forecast"
        title="About this forecast"
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#193B66] text-white shadow-xl ring-4 ring-white/70 transition-all duration-200 hover:-translate-y-1 hover:bg-[#275788] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#193B66]"
      >
        <svg
          viewBox="0 0 24 24"
          width="25"
          height="25"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 8h.01" />
        </svg>
      </button>

      {/* INFORMATION DIALOG */}

      {open && (
        <div className="fixed inset-0 z-50">
          <div
            aria-hidden="true"
            onClick={() => setOpen(false)}
            className="absolute inset-0 h-full w-full bg-[#0F172A]/40 backdrop-blur-[2px]"
          />

          <section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="forecast-info-title"
            className="absolute bottom-6 right-4 flex max-h-[85vh] w-[calc(100%-2rem)] max-w-[440px] flex-col overflow-hidden rounded-2xl border border-[#D7E0EB] bg-white shadow-2xl sm:right-6"
          >
            {/* DIALOG HEADER */}

            <div className="flex items-start justify-between gap-4 border-b border-[#E6EDF4] bg-[#F8FAFD] p-5">
              <div>
                <h2
                  id="forecast-info-title"
                  className="text-lg font-bold text-[#25334A]"
                >
                  About this forecast
                </h2>

                <p className="mt-1 text-xs text-[#61738B]">
                  Methodology, uncertainty, and model notes
                </p>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#61738B] hover:bg-[#E6EDF4]"
              >
                ✕
              </button>
            </div>

            {/* DIALOG CONTENT */}

            <div className="overflow-y-auto p-5">
              <h3 className="text-sm font-bold text-[#25334A]">
                Methodology and limitations
              </h3>

              <p className="mt-3 text-sm leading-7 text-[#61738B]">
                MarketLens forecasts are model-generated
                estimates based partly on simulated market
                and financial data. Estimated ranges describe
                typical model errors, not guaranteed
                confidence intervals.
              </p>

              <p className="mt-3 text-sm leading-7 text-[#61738B]">
                The charts and metrics reflect predictions
                for the selected forecast period. Actual
                sales and financial performance may differ.
              </p>

              {Array.isArray(notes) &&
                notes.length > 0 && (
                  <div className="mt-5 rounded-xl bg-[#F5F8FC] p-4">
                    <h4 className="text-sm font-bold text-[#25334A]">
                      Additional model notes
                    </h4>

                    <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-[#61738B]">
                      {notes.map((note, index) => (
                        <li key={index}>
                          {note}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
            </div>

            {/* DIALOG FOOTER */}

            <div className="border-t border-[#E6EDF4] p-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full rounded-xl bg-[#193B66] px-5 py-3 text-sm font-semibold text-white hover:bg-[#275788]"
              >
                Got it
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

// ========================================
// MAIN SALES FORECAST PAGE
// ========================================

export default function SalesForecastOverview({
  forecast,
}) {
  const monthly =
    forecast?.type === "existing"
      ? forecast.monthly
      : null;

  const yearly =
    forecast?.type === "existing"
      ? forecast.yearly
      : null;

  const [timeframe, setTimeframe] = useState(
    () => (monthly ? "monthly" : "yearly")
  );

  const hasForecast = Boolean(monthly || yearly);

  const activeTimeframe =
    timeframe === "monthly" && !monthly
      ? "yearly"
      : timeframe === "yearly" && !yearly
        ? "monthly"
        : timeframe;

  const selectedForecast =
    activeTimeframe === "monthly"
      ? monthly
      : yearly;

  const predictions =
    selectedForecast?.predictions;

  const productName =
    monthly?.product_name ||
    yearly?.product_name ||
    "Selected product";

  const productId =
    forecast?.productId ||
    monthly?.product_id ||
    yearly?.product_id;

  const period =
    activeTimeframe === "monthly"
      ? selectedForecast?.month
      : selectedForecast?.year;

  const mainMetrics = [
    {
      label: "Gross revenue",
      metric: predictions?.gross_revenue,
      subtitle: "Estimated sales revenue",
      variant: "revenue",
    },

    {
      label: "Units sold",
      metric: predictions?.units_sold,
      subtitle: "Predicted sales volume",
      variant: "units",
    },

    {
      label: "Net profit",
      metric: predictions?.net_profit,
      subtitle: "Estimated net earnings",
      variant: "profit",
    },
  ];

  // ========================================
  // EMPTY STATE
  // ========================================

  if (!hasForecast) {
    return (
      <main className="mx-auto max-w-[1440px] px-6 py-12 lg:px-24">
        <h1 className="text-3xl font-bold text-[#25334A]">
          Sales forecast overview
        </h1>

        <p className="mt-4 text-[#61738B]">
          No existing-product forecast is available.
        </p>

        <Link
          to="/discover"
          className="mt-6 inline-block rounded-lg bg-[#FFD45A] px-6 py-3 font-semibold text-[#25334A]"
        >
          Discover products
        </Link>
      </main>
    );
  }

  // ========================================
  // PAGE LAYOUT
  // ========================================

  return (
    <main className="mx-auto max-w-[1440px] px-5 py-8 text-[#0F172A] sm:px-8 lg:px-16 xl:px-24">
      {/* BREADCRUMB */}

      <div className="text-xs text-[#61738B]">
        Discover
        <span className="mx-3">›</span>
        Sales Forecasting
        <span className="mx-3">›</span>
        Existing Product
      </div>

      {/* PAGE HEADER */}

      <div className="mt-6 flex flex-col justify-between gap-5 md:flex-row md:items-start">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.13em] text-[#A77E1C]">
            MarketLens / Sales Intelligence
          </p>

          <h1 className="text-3xl font-bold tracking-tight text-[#25334A] sm:text-4xl">
            Sales forecast
          </h1>

          <p className="mt-3 text-sm leading-6 text-[#61738B] sm:text-base">
            Estimated sales, demand, and financial
            performance for an existing product.
          </p>
        </div>

        <Link
          to="/discover"
          className="shrink-0 rounded-xl border border-[#D4A529] bg-white px-5 py-3 text-center text-sm font-semibold text-[#25334A] hover:bg-[#FFFAEC]"
        >
          Forecast another product
        </Link>
      </div>

      {/* PRODUCT SUMMARY */}

      <section className="mt-7 rounded-2xl border border-[#D7E0EB] bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#A77E1C]">
              Existing product
            </p>

            <h2 className="mt-2 break-words text-lg font-bold text-[#25334A] sm:text-xl">
              {productName}
            </h2>

            {productId && (
              <p className="mt-2 break-all text-sm text-[#61738B]">
                Product ID: {productId}
              </p>
            )}
          </div>

          <div className="self-start rounded-xl bg-[#FFF6DD] px-4 py-3 sm:self-center">
            <p className="text-xs font-semibold text-[#8B6B1E]">
              Forecast period
            </p>

            <p className="mt-1 text-sm font-bold text-[#25334A]">
              {formatPeriod(period)}
            </p>
          </div>
        </div>
      </section>

      {/* FORECAST SELECTOR */}

      <section className="mt-9">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <SectionHeading
            eyebrow="Forecast performance"
            title="Prediction overview"
            description={`Showing ${
              activeTimeframe === "monthly"
                ? "monthly"
                : "yearly"
            } estimates for ${formatPeriod(period)}.`}
          />

          <div
            role="group"
            aria-label="Forecast timeframe"
            className="inline-flex w-fit gap-1 rounded-xl border border-[#D7E0EB] bg-white p-1 shadow-sm"
          >
            <button
              type="button"
              disabled={!monthly}
              onClick={() =>
                setTimeframe("monthly")
              }
              aria-pressed={
                activeTimeframe === "monthly"
              }
              className={`rounded-lg px-5 py-3 text-sm font-semibold disabled:opacity-40 ${
                activeTimeframe === "monthly"
                  ? "bg-[#FFD45A] text-[#25334A]"
                  : "text-[#61738B] hover:bg-[#F5F8FC]"
              }`}
            >
              Monthly
            </button>

            <button
              type="button"
              disabled={!yearly}
              onClick={() =>
                setTimeframe("yearly")
              }
              aria-pressed={
                activeTimeframe === "yearly"
              }
              className={`rounded-lg px-5 py-3 text-sm font-semibold disabled:opacity-40 ${
                activeTimeframe === "yearly"
                  ? "bg-[#FFD45A] text-[#25334A]"
                  : "text-[#61738B] hover:bg-[#F5F8FC]"
              }`}
            >
              Yearly
            </button>
          </div>
        </div>

        {/* PRIMARY KPIS */}

        {predictions ? (
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {mainMetrics.map((item) => (
              <HeroMetric
                key={item.label}
                {...item}
              />
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-[#D7E0EB] bg-white p-6 text-sm text-[#61738B]">
            Forecast metrics unavailable.
          </div>
        )}
      </section>

      {/* FINANCIAL AND DEMAND CHARTS */}

      {predictions && (
        <section className="mt-10">
          <SectionHeading
            eyebrow="Visual analytics"
            title="Forecast breakdown"
            description="Explore predicted financial and demand metrics."
          />

          <div className="mt-6 grid items-start gap-5 lg:grid-cols-2">
            <ChartCard
              title="Revenue vs. estimated costs"
              description="Financial performance comparison."
            >
              <FinancialChart
                predictions={predictions}
              />
            </ChartCard>

            <ChartCard
              title="Sales vs. demand"
              description="Sales volume and estimated demand."
            >
              <DemandChart
                predictions={predictions}
              />
            </ChartCard>
          </div>
        </section>
      )}

      {/* PROFITABILITY AND DEMAND FLIP PANELS */}

      {predictions && (
        <section className="mt-6 grid items-stretch gap-5 lg:grid-cols-2">
          <ProfitabilityPanel
            key={`profit-${productId}-${activeTimeframe}`}
            predictions={predictions}
          />

          <DemandDirectionPanel
            key={`demand-${productId}-${activeTimeframe}`}
            timeframe={activeTimeframe}
            selectedForecast={selectedForecast}
            predictions={predictions}
          />
        </section>
      )}

      {/* SUPPORTING METRICS WITH FULL-PANEL FLIP */}

      {predictions && (
        <SupportingMetrics
          key={`support-${productId}-${activeTimeframe}`}
          predictions={predictions}
          timeframe={activeTimeframe}
        />
      )}

      {/* FORECAST DETAILS */}

      {selectedForecast && (
        <ForecastDetails
          timeframe={activeTimeframe}
          selectedForecast={selectedForecast}
          period={period}
        />
      )}

      {/* FLOATING ABOUT THIS FORECAST BUTTON */}

      <AboutForecast
        key={`about-${productId}-${activeTimeframe}`}
        notes={selectedForecast?.notes}
      />
    </main>
  );
}
