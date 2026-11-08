
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

// ============================================================
// DUPLICATED FROM SalesForecastOverview.jsx
// ------------------------------------------------------------
// Everything from here down to "END OF DUPLICATED SECTION" is
// copied unchanged from src/pages/SalesForecastOverview.jsx
// (theme, formatting helpers, SectionHeading, RangeText,
// HeroMetric, ChartCard, CustomTooltip, AboutForecast) so
// both forecast pages look identical.
// TODO: extract these into a shared file (for example
// src/components/forecast/ForecastUI.jsx) and import them
// from both pages, so they cannot drift apart.
// ============================================================

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
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.13em] text-[#8A6614]">
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

function RangeText({ metric, light = false, colorClass }) {
  const range = validRange(metric);

  // colorClass lets a card override the default (for
  // example dark text on the light yellow card, where
  // translucent white is unreadable).
  const color =
    colorClass ||
    (light ? "text-white/75" : "text-[#61738B]");

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
      // Dark range text: white is unreadable on yellow.
      range: "text-[#6C5528]",
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
        <RangeText
          metric={metric}
          light
          colorClass={style.range}
        />
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

// ============================================================
// END OF DUPLICATED SECTION
// ============================================================

// ========================================
// LAUNCH-SPECIFIC HELPERS
// ========================================

const TIMEFRAMES = {
  "12m": { label: "12 months", long: "first 12 months" },
  "24m": { label: "24 months", long: "first 24 months" },
};

// Never-pays-back risk levels returned by the API.
const RISK_STYLES = {
  low: {
    label: "Low risk",
    text: "text-[#13795B]",
    badge: "bg-[#E6F5ED] text-[#13795B]",
    bar: "bg-[#13795B]",
  },
  medium: {
    label: "Medium risk",
    text: "text-[#97531B]",
    badge: "bg-[#FFF2E8] text-[#97531B]",
    bar: "bg-[#D4A529]",
  },
  high: {
    label: "High risk",
    text: "text-red-700",
    badge: "bg-red-50 text-red-700",
    bar: "bg-red-600",
  },
};

function riskStyle(level) {
  return (
    RISK_STYLES[String(level || "").toLowerCase()] || {
      label: "Risk level unavailable",
      text: "text-[#25334A]",
      badge: "bg-slate-100 text-[#475569]",
      bar: "bg-[#8FA4BA]",
    }
  );
}

function formatPercentValue(value) {
  const number = numberOrNull(value);
  return number === null ? "—" : `${number.toFixed(2)}%`;
}

// The backend's model notes use internal field names such as
// "plus_minus". Replace them with the wording users see on
// this page before the notes are shown in the ⓘ dialog.
// Example: "...; plus_minus is the model's typical error..."
// becomes "...; the estimated range is the model's typical error...".
function friendlyNotes(notes) {
  if (!Array.isArray(notes)) return notes;

  return notes
    .filter((note) => typeof note === "string" && note.trim())
    .map((note) => {
      const text = note.replace(
        /\bplus[_\s-]?minus\b/gi,
        "the estimated range"
      );

      return text.charAt(0).toUpperCase() + text.slice(1);
    });
}

// ========================================
// SECONDARY METRIC TILE
// ========================================

function MetricTile({ label, metric, description }) {
  const value = getValue(metric);
  const negative = value !== null && value < 0;

  return (
    <article className="min-w-0 rounded-2xl border border-[#D7E0EB] bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-[#61738B]">
        {label}
      </p>

      <p
        className={`mt-3 break-words text-3xl font-bold tracking-tight ${
          negative ? "text-red-700" : "text-[#25334A]"
        }`}
      >
        {formatMetric(metric)}
      </p>

      <RangeText metric={metric} />

      {description && (
        <p className="mt-3 text-xs leading-5 text-[#61738B]">
          {description}
        </p>
      )}
    </article>
  );
}

// ========================================
// REVENUE VS. COSTS (SELECTED PERIOD)
// ========================================

function LaunchFinancialChart({ revenueMetric, profitMetric, periodLabel }) {
  const revenue = getValue(revenueMetric);
  const profit = getValue(profitMetric);

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
    { name: "Revenue", value: revenue, color: COLORS.gold },
    { name: "Costs", value: costs, color: COLORS.slate },
  ];

  return (
    <>
      <div
        className="h-[260px] w-full"
        role="img"
        aria-label={`${periodLabel}: revenue ${formatCurrency(
          revenue
        )}; estimated costs ${formatCurrency(costs)}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 12, right: 14, bottom: 0, left: 0 }}
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
              tick={{ fill: COLORS.muted, fontSize: 12 }}
            />

            <YAxis
              axisLine={false}
              tickLine={false}
              width={65}
              tick={{ fill: COLORS.muted, fontSize: 11 }}
              tickFormatter={(value) => `$${formatCompact(value)}`}
            />

            <Tooltip
              content={<CustomTooltip currency />}
              cursor={{ fill: "#F5F7FA" }}
            />

            <Bar dataKey="value" maxBarSize={92} radius={[8, 8, 0, 0]}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
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
            profit < 0 ? "text-red-700" : "text-[#193B66]"
          }`}
        >
          {formatCurrency(profit)}
        </p>
      </div>
    </>
  );
}

// ========================================
// 12 VS. 24 MONTHS COMPARISON
// ========================================

// One metric, 12 vs. 24 months, on its own scale so a small
// value (net profit) stays readable next to a large one
// (revenue).
function HorizonBar({ title, value12, value24 }) {
  if (value12 === null || value24 === null) {
    return (
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#25334A]">
          {title}
        </p>
        <p className="py-8 text-sm text-[#61738B]">
          Unavailable.
        </p>
      </div>
    );
  }

  const data = [
    { name: "12 months", value: value12, color: COLORS.gold },
    { name: "24 months", value: value24, color: COLORS.navy },
  ];

  return (
    <div className="min-w-0">
      <p className="text-sm font-semibold text-[#25334A]">
        {title}
      </p>

      <div
        className="mt-2 h-[200px] w-full"
        role="img"
        aria-label={`${title}: ${formatCurrency(
          value12
        )} in the first 12 months, ${formatCurrency(
          value24
        )} in the first 24 months`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 12, right: 8, bottom: 0, left: 0 }}
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
              tick={{ fill: COLORS.muted, fontSize: 11 }}
            />

            <YAxis
              axisLine={false}
              tickLine={false}
              width={52}
              tick={{ fill: COLORS.muted, fontSize: 11 }}
              tickFormatter={(value) => `$${formatCompact(value)}`}
            />

            <Tooltip
              content={<CustomTooltip currency />}
              cursor={{ fill: "#F5F7FA" }}
            />

            <Bar dataKey="value" maxBarSize={64} radius={[8, 8, 0, 0]}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function HorizonComparisonChart({ predictions }) {
  const units12 = getValue(predictions?.units_sold_12m);
  const units24 = getValue(predictions?.units_sold_24m);

  return (
    <>
      <div className="grid gap-6 sm:grid-cols-2">
        <HorizonBar
          title="Revenue"
          value12={getValue(predictions?.revenue_12m)}
          value24={getValue(predictions?.revenue_24m)}
        />

        <HorizonBar
          title="Net profit"
          value12={getValue(predictions?.profit_12m)}
          value24={getValue(predictions?.profit_24m)}
        />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-[#FFF8E5] p-4">
          <p className="text-xs text-[#8B6B1E]">
            Units sold, 12 months
          </p>
          <p className="mt-2 text-xl font-bold text-[#25334A]">
            {formatNumber(units12)}
          </p>
        </div>

        <div className="rounded-xl bg-[#F1F6FC] p-4">
          <p className="text-xs text-[#56677E]">
            Units sold, 24 months
          </p>
          <p className="mt-2 text-xl font-bold text-[#25334A]">
            {formatNumber(units24)}
          </p>
        </div>
      </div>
    </>
  );
}

// ========================================
// PAYBACK AND RISK
// ========================================

function PaybackAndRisk({ predictions }) {
  const breakEven = predictions?.break_even_months;
  const neverPays = predictions?.never_breaks_even;

  const breakEvenValue = getValue(breakEven);
  const neverPaysValue = getValue(neverPays);
  const risk = riskStyle(neverPays?.risk_level);

  const riskWidth =
    neverPaysValue === null
      ? 0
      : Math.max(0, Math.min(100, neverPaysValue));

  return (
    <section className="mt-10">
      <SectionHeading
        eyebrow="Payback and risk"
        title="When does the launch pay for itself?"
        description="Estimated time to recover launch costs, and the chance it never does."
      />

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <article className="rounded-2xl border border-[#D7E0EB] bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-[#61738B]">
            Months to break even
          </p>

          <p className="mt-4 text-4xl font-bold tracking-tight text-[#25334A]">
            {breakEven?.display ||
              (breakEvenValue === null
                ? "—"
                : `~${Math.round(breakEvenValue)} months`)}
          </p>

          <RangeText
            metric={
              breakEven
                ? { ...breakEven, unit: "months" }
                : null
            }
          />

          <p className="mt-4 text-xs leading-5 text-[#61738B]">
            Includes the estimated one-time launch cost
            (see Unit economics below).
          </p>
        </article>

        <article className="rounded-2xl border border-[#D7E0EB] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="text-sm font-medium text-[#61738B]">
              Chance it never pays back
            </p>

            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${risk.badge}`}
            >
              {risk.label}
            </span>
          </div>

          <p className={`mt-4 text-4xl font-bold tracking-tight ${risk.text}`}>
            {neverPaysValue === null
              ? "—"
              : `${neverPaysValue.toFixed(1)}%`}
          </p>

          <div
            className="mt-6 h-3 overflow-hidden rounded-full bg-[#E7EDF3]"
            role="progressbar"
            aria-label="Chance it never pays back"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(riskWidth)}
          >
            <div
              className={`h-full rounded-full ${risk.bar}`}
              style={{ width: `${riskWidth}%` }}
            />
          </div>

          <div className="mt-2 flex justify-between text-xs text-[#61738B]">
            <span>0%</span>
            <span>100%</span>
          </div>
        </article>
      </div>
    </section>
  );
}

// ========================================
// UNIT ECONOMICS
// ========================================

function UnitEconomics({ economics }) {
  if (!economics || typeof economics !== "object") {
    return null;
  }

  const sizeTier = economics.size_tier
    ? String(economics.size_tier)
        .replace(/_/g, " ")
        .replace(/\b\w/g, (character) => character.toUpperCase())
    : "—";

  const weight = numberOrNull(economics.est_weight_lb);

  const items = [
    {
      label: "FBA fee per unit",
      value: formatCurrency(economics.fba_fee),
    },
    {
      label: "Referral fee per unit",
      value: formatCurrency(economics.referral_fee),
    },
    {
      label: "Landed cost per unit",
      value: formatCurrency(economics.landed_cost),
    },
    {
      label: "Pre-advertising unit margin",
      value: formatPercentValue(economics.pre_ad_unit_margin_pct),
    },
    {
      label: "One-time launch cost",
      value: formatCurrency(economics.launch_fixed_cost),
    },
    {
      label: "Estimated size tier",
      value: sizeTier,
    },
    {
      label: "Estimated weight",
      value: weight === null ? "—" : `${weight.toFixed(2)} lb`,
    },
  ];

  return (
    <section className="mt-10 rounded-2xl border border-[#D7E0EB] bg-white p-6 shadow-sm">
      <SectionHeading
        eyebrow="Cost assumptions"
        title="Unit economics"
        description="Per-unit fees and costs the model assumed for this launch."
      />

      <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <div
            key={item.label}
            className="min-w-0 rounded-xl border border-[#E6EDF4] bg-[#FAFCFE] p-4"
          >
            <dt className="text-xs font-medium text-[#61738B]">
              {item.label}
            </dt>
            <dd className="mt-2 break-words text-base font-bold text-[#25334A]">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// ========================================
// DEMAND (12 MONTHS ONLY)
// ========================================

function LaunchDemand({ predictions }) {
  const metrics = [
    {
      label: "Demand, first 12 months",
      metric: predictions?.demand_units_12m,
    },
    {
      label: "Average monthly demand",
      metric: predictions?.avg_monthly_demand_12m,
    },
    {
      label: "Share of category demand",
      metric: predictions?.demand_share_pct_12m,
    },
  ].filter((item) => item.metric);

  if (metrics.length === 0) return null;

  return (
    <section className="mt-10">
      <SectionHeading
        eyebrow="Demand intelligence"
        title="Market demand"
        description="Demand estimates cover the first 12 months only."
      />

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {metrics.map((item) => (
          <MetricTile
            key={item.label}
            label={item.label}
            metric={item.metric}
          />
        ))}
      </div>
    </section>
  );
}

// ========================================
// MAIN LAUNCH FORECAST PAGE
// ========================================

export default function LaunchForecastOverview({
  launchForecast,
}) {
  const [timeframe, setTimeframe] = useState("12m");

  const predictions = launchForecast?.predictions;
  const input = launchForecast?.input || {};

  // ========================================
  // EMPTY STATE
  // ========================================

  if (!predictions || typeof predictions !== "object") {
    return (
      <main className="mx-auto max-w-[1440px] px-6 py-12 lg:px-24">
        <h1 className="text-3xl font-bold text-[#25334A]">
          Launch forecast
        </h1>

        <p className="mt-4 text-[#61738B]">
          No launch forecast is available yet. Choose
          Sales Forecasting, then New Product Launch, on
          the Discover page.
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

  const period = TIMEFRAMES[timeframe];
  const suffix = timeframe;

  const mainMetrics = [
    {
      label: "Revenue",
      metric: predictions[`revenue_${suffix}`],
      subtitle: `Estimated revenue, ${period.long}`,
      variant: "revenue",
    },
    {
      label: "Units sold",
      metric: predictions[`units_sold_${suffix}`],
      subtitle: `Predicted sales volume, ${period.long}`,
      variant: "units",
    },
    {
      label: "Net profit",
      metric: predictions[`profit_${suffix}`],
      subtitle: `Estimated net earnings, ${period.long}`,
      variant: "profit",
    },
  ];

  const listPrice = numberOrNull(input.list_price);

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
        New Product Launch
      </div>

      {/* PAGE HEADER */}

      <div className="mt-6 flex flex-col justify-between gap-5 md:flex-row md:items-start">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.13em] text-[#8A6614]">
            MarketLens / Launch Intelligence
          </p>

          <h1 className="text-3xl font-bold tracking-tight text-[#25334A] sm:text-4xl">
            Launch forecast
          </h1>

          <p className="mt-3 text-sm leading-6 text-[#61738B] sm:text-base">
            Estimated sales, profit, and payback for the
            first 12 and 24 months after launch.
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
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-[#8A6614]">
              New product
            </p>

            <h2 className="mt-2 break-words text-lg font-bold text-[#25334A] sm:text-xl">
              {input.name || "Unnamed product"}
            </h2>

            {input.category && (
              <p className="mt-2 text-sm text-[#61738B]">
                {input.category}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3 self-start sm:self-center">
            <div className="rounded-xl bg-[#FFF6DD] px-4 py-3">
              <p className="text-xs font-semibold text-[#8B6B1E]">
                Selling price
              </p>
              <p className="mt-1 text-sm font-bold text-[#25334A]">
                {formatCurrency(input.price)}
              </p>
            </div>

            {listPrice !== null && (
              <div className="rounded-xl bg-[#F1F6FC] px-4 py-3">
                <p className="text-xs font-semibold text-[#56677E]">
                  List price
                </p>
                <p className="mt-1 text-sm font-bold text-[#25334A]">
                  {formatCurrency(listPrice)}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* TIMEFRAME SELECTOR AND PRIMARY KPIS */}

      <section className="mt-9">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <SectionHeading
            eyebrow="Forecast performance"
            title="Prediction overview"
            description={`Showing estimates for the ${period.long} after launch.`}
          />

          <div
            role="group"
            aria-label="Forecast timeframe"
            className="inline-flex w-fit gap-1 rounded-xl border border-[#D7E0EB] bg-white p-1 shadow-sm"
          >
            {Object.entries(TIMEFRAMES).map(([value, option]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTimeframe(value)}
                aria-pressed={timeframe === value}
                className={`rounded-lg px-5 py-3 text-sm font-semibold ${
                  timeframe === value
                    ? "bg-[#FFD45A] text-[#25334A]"
                    : "text-[#61738B] hover:bg-[#F5F8FC]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {mainMetrics.map((item) => (
            <HeroMetric key={item.label} {...item} />
          ))}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <MetricTile
            label="Profit margin"
            metric={predictions[`margin_pct_${suffix}`]}
            description="Net profit as a percentage of revenue."
          />

          <MetricTile
            label="Return on investment"
            metric={predictions[`roi_pct_${suffix}`]}
            description="Net profit relative to the money invested."
          />

          {timeframe === "12m" && predictions.avg_price_12m ? (
            <MetricTile
              label="Average selling price"
              metric={predictions.avg_price_12m}
              description="Expected average price over the first 12 months."
            />
          ) : (
            <MetricTile
              label="Units sold, first 12 months"
              metric={predictions.units_sold_12m}
              description="For comparison with the 24-month total."
            />
          )}
        </div>
      </section>

      {/* CHARTS */}

      <section className="mt-10">
        <SectionHeading
          eyebrow="Visual analytics"
          title="Forecast breakdown"
          description="Explore predicted financial performance over time."
        />

        <div className="mt-6 grid items-start gap-5 lg:grid-cols-2">
          <ChartCard
            title="Revenue vs. estimated costs"
            description={`Financial performance, ${period.long}.`}
          >
            <LaunchFinancialChart
              revenueMetric={predictions[`revenue_${suffix}`]}
              profitMetric={predictions[`profit_${suffix}`]}
              periodLabel={period.long}
            />
          </ChartCard>

          <ChartCard
            title="12 vs. 24 months"
            description="How revenue, profit, and volume grow in the second year."
          >
            <HorizonComparisonChart predictions={predictions} />
          </ChartCard>
        </div>
      </section>

      {/* PAYBACK AND RISK */}

      <PaybackAndRisk predictions={predictions} />

      {/* DEMAND */}

      <LaunchDemand predictions={predictions} />

      {/* UNIT ECONOMICS */}

      <UnitEconomics economics={launchForecast.unit_economics} />

      {/* FLOATING ABOUT THIS FORECAST BUTTON */}

      <AboutForecast notes={friendlyNotes(launchForecast.notes)} />
    </main>
  );
}
