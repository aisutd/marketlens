
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart,
  Bar,
  Cell,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowLeft,
  ArrowRight,
  CircleHelp,
  Info,
} from "lucide-react";

// ========================================
// COLORS AND STYLES
// ========================================

const COLORS = {
  orange: "#D95332",
  green: "#47866B",
  ink: "#1D150F",
  muted: "#776C61",
  cream: "#F8EEE0",
};

const primaryButton =
  "inline-flex items-center justify-center gap-3 " +
  "border border-ink bg-primary px-6 py-3 " +
  "font-semibold text-primary-foreground shadow-offset " +
  "transition-transform duration-150 " +
  "hover:translate-x-[2px] hover:translate-y-[2px]";

const cardHover =
  "transition-[background-color,box-shadow,transform] " +
  "duration-200 hover:-translate-y-[2px] " +
  "hover:shadow-offset motion-reduce:transform-none";

// ========================================
// FORMATTING
// ========================================

function numeric(value) {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    !Number.isFinite(Number(value))
  ) {
    return null;
  }

  return Number(value);
}

function metricValue(metric) {
  return numeric(metric?.value);
}

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatNumber(value) {
  const result = numeric(value);

  return result === null
    ? "—"
    : numberFormatter.format(result);
}

function formatMoney(value) {
  const result = numeric(value);

  return result === null
    ? "—"
    : moneyFormatter.format(result);
}

function formatCompact(value) {
  const result = numeric(value);

  return result === null
    ? "—"
    : compactFormatter.format(result);
}

function formatMetric(metric) {
  const value = metricValue(metric);

  if (value === null) return "—";

  if (metric.unit === "USD") {
    return formatMoney(value);
  }

  if (metric.unit === "%") {
    return `${value.toFixed(2)}%`;
  }

  return formatNumber(value);
}

function metricRange(metric) {
  const range = metric?.range;
  const value = metricValue(metric);

  if (
    !Array.isArray(range) ||
    range.length !== 2 ||
    value === null
  ) {
    return null;
  }

  const low = numeric(range[0]);
  const high = numeric(range[1]);

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
// SHARED COMPONENTS
// ========================================

function SectionHeading({
  number,
  eyebrow,
  title,
  description,
}) {
  return (
    <div>
      <p className="eyebrow flex items-center gap-3 text-muted-foreground">
        <span className="text-primary">
          {number}
        </span>

        <span className="h-px w-8 bg-current" />

        {eyebrow}
      </p>

      <h2 className="mt-4 font-display text-3xl leading-tight sm:text-4xl">
        {title}
      </h2>

      {description && (
        <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  );
}

function RangeText({ metric }) {
  const range = metricRange(metric);

  if (!range) return null;

  return (
    <p className="mt-3 text-xs leading-6 text-muted-foreground">
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

function MetricCard({
  label,
  metric,
  description,
  highlighted = false,
}) {
  return (
    <article
      className={
        "flex min-h-48 min-w-0 flex-col justify-between border border-ink p-6 " +
        (highlighted
          ? "bg-[#F8EEE0] "
          : "bg-card ") +
        cardHover
      }
    >
      <p className="eyebrow text-muted-foreground">
        {label}
      </p>

      <div className="mt-8">
        <p className="break-words font-display text-4xl leading-tight">
          {formatMetric(metric)}
        </p>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {description}
        </p>

        <RangeText metric={metric} />
      </div>
    </article>
  );
}

// ========================================
// ALIGNED CHART CARD
// ========================================

function ChartPanel({
  title,
  description,
  children,
}) {
  return (
    <article className="flex h-full min-w-0 flex-col border border-ink bg-card p-5 sm:p-7">
      <div className="min-h-[120px]">
        <h3 className="font-display text-2xl leading-tight">
          {title}
        </h3>

        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          {description}
        </p>
      </div>

      <div className="mt-5 flex flex-1 flex-col">
        {children}
      </div>
    </article>
  );
}

function ChartValues({ items }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((item, index) => (
        <div
          key={item.label}
          className={
            "flex min-h-[112px] min-w-0 flex-col justify-center border border-border p-4 " +
            (index === 0
              ? "bg-[#F8EEE0]"
              : "bg-background")
          }
        >
          <p className="text-xs leading-5 text-muted-foreground">
            {item.label}
          </p>

          <p className="mt-2 break-words font-display text-xl leading-tight sm:text-2xl">
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function ForecastTooltip({
  active,
  payload,
  money = false,
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const entry = payload[0];

  return (
    <div className="border border-ink bg-card px-4 py-3 shadow-offset">
      <p className="text-sm font-semibold">
        {entry.payload?.name || entry.name}
      </p>

      <p className="mt-2 font-mono text-sm">
        {money
          ? formatMoney(entry.value)
          : formatNumber(entry.value)}
      </p>
    </div>
  );
}

// ========================================
// FINANCIAL CHART
// ========================================

function FinancialChart({ predictions }) {
  const revenue = metricValue(
    predictions?.gross_revenue
  );

  const profit = metricValue(
    predictions?.net_profit
  );

  const calculatedCosts =
    revenue !== null && profit !== null
      ? revenue - profit
      : null;

  const valid =
    revenue !== null &&
    profit !== null &&
    calculatedCosts !== null &&
    revenue >= 0 &&
    calculatedCosts >= 0;

  if (!valid) {
    return (
      <div className="flex h-full min-h-[440px] items-center justify-center">
        <p className="text-sm text-muted-foreground">
          There isn't enough information to compare
          revenue and costs.
        </p>
      </div>
    );
  }

  const data = [
    {
      name: "Revenue",
      value: revenue,
      color: COLORS.orange,
    },
    {
      name: "Costs*",
      value: calculatedCosts,
      color: COLORS.green,
    },
  ];

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div
        className="h-[270px] w-full shrink-0"
        role="img"
        aria-label={`Estimated revenue ${formatMoney(revenue)} and calculated costs ${formatMoney(calculatedCosts)}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{
              top: 12,
              right: 12,
              bottom: 0,
              left: 0,
            }}
          >
            <CartesianGrid
              vertical={false}
              stroke="#E8DED2"
            />

            <XAxis
              dataKey="name"
              tickLine={false}
              axisLine={false}
              tick={{
                fill: COLORS.muted,
                fontSize: 12,
              }}
            />

            <YAxis
              tickLine={false}
              axisLine={false}
              width={66}
              tick={{
                fill: COLORS.muted,
                fontSize: 11,
              }}
              tickFormatter={(value) =>
                `$${formatCompact(value)}`
              }
            />

            <Tooltip
              content={<ForecastTooltip money />}
              cursor={{ fill: COLORS.cream }}
            />

            <Bar
              dataKey="value"
              maxBarSize={90}
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

      <div className="mt-5">
        <ChartValues
          items={[
            {
              label: "Revenue",
              value: formatMoney(revenue),
            },
            {
              label: "Calculated costs",
              value: formatMoney(calculatedCosts),
            },
          ]}
        />
      </div>

      <div className="mt-auto min-h-[78px] pt-5">
        <p className="text-xs leading-6 text-muted-foreground">
          *Costs are calculated by subtracting
          estimated net profit from estimated revenue.
          They are not a separate cost estimate.
        </p>
      </div>
    </div>
  );
}

// ========================================
// SALES AND DEMAND CHART
// ========================================

function DemandChart({ predictions }) {
  const sales = metricValue(
    predictions?.units_sold
  );

  const demand = metricValue(
    predictions?.demand_units
  );

  if (
    sales === null ||
    demand === null ||
    sales < 0 ||
    demand < 0
  ) {
    return (
      <div className="flex h-full min-h-[440px] items-center justify-center">
        <p className="text-sm text-muted-foreground">
          A sales and demand comparison isn't
          available for this period.
        </p>
      </div>
    );
  }

  const data = [
    {
      name: "Sales",
      value: sales,
      color: COLORS.orange,
    },
    {
      name: "Demand",
      value: demand,
      color: COLORS.green,
    },
  ];

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div
        className="h-[270px] w-full shrink-0"
        role="img"
        aria-label={`Estimated sales ${formatNumber(sales)} units; estimated demand ${formatNumber(demand)} units`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={data}
            margin={{
              top: 10,
              right: 22,
              bottom: 0,
              left: 0,
            }}
          >
            <CartesianGrid
              horizontal={false}
              stroke="#E8DED2"
            />

            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tick={{
                fill: COLORS.muted,
                fontSize: 11,
              }}
              tickFormatter={formatCompact}
            />

            <YAxis
              type="category"
              dataKey="name"
              width={70}
              tickLine={false}
              axisLine={false}
              tick={{
                fill: COLORS.muted,
                fontSize: 12,
              }}
            />

            <Tooltip
              content={<ForecastTooltip />}
              cursor={{ fill: COLORS.cream }}
            />

            <Bar
              dataKey="value"
              maxBarSize={54}
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

      <div className="mt-5">
        <ChartValues
          items={[
            {
              label: "Estimated sales",
              value: formatNumber(sales),
            },
            {
              label: "Estimated demand",
              value: formatNumber(demand),
            },
          ]}
        />
      </div>

      <div className="mt-auto min-h-[78px] pt-5">
        <p className="text-xs leading-6 text-muted-foreground">
          Both figures are estimates. Neither
          confirms how many people will buy this
          product. Actual sales depend on factors
          such as price, availability, and competition.
        </p>
      </div>
    </div>
  );
}

// ========================================
// PROFITABILITY
// ========================================

function ProfitabilitySection({
  predictions,
  timeframe,
}) {
  const margin = metricValue(
    predictions?.profit_margin_pct
  );

  const cumulativeROI = metricValue(
    predictions?.roi_cum_pct
  );

  const periodROI =
    timeframe === "yearly"
      ? predictions?.roi_year_pct
      : predictions?.roi_unit_pct;

  return (
    <section className="mt-14">
      <SectionHeading
        number="03"
        eyebrow="Profitability"
        title="How profitable could this be?"
        description="Explore how much money might remain after costs and how the estimated return compares with the investment."
      />

      <div className="mt-7 grid gap-5 md:grid-cols-3">
        <MetricCard
          label="Profit margin"
          metric={predictions?.profit_margin_pct}
          description="The estimated portion of sales revenue remaining as profit."
          highlighted
        />

        <MetricCard
          label="Return on investment"
          metric={periodROI}
          description={
            timeframe === "yearly"
              ? "Estimated return for the selected year."
              : "Estimated return associated with each unit."
          }
        />

        <MetricCard
          label="Cumulative return"
          metric={predictions?.roi_cum_pct}
          description="Estimated return accumulated through the selected period."
        />
      </div>

      <div className="mt-6 border border-ink bg-card p-6">
        <p className="font-semibold">
          What does this suggest?
        </p>

        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          {margin === null
            ? "A profit margin estimate isn't available for this period."
            : margin > 0
              ? "The forecast shows a positive profit margin. Check whether your actual expenses would leave enough profit to support the business."
              : margin < 0
                ? "The forecast shows a negative profit margin. Review the costs and pricing assumptions before making an investment decision."
                : "The forecast shows little or no profit remaining from sales. Consider whether the planned price and costs are sustainable."}
        </p>

        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          {cumulativeROI === null
            ? "An overall investment return estimate isn't available."
            : cumulativeROI < 0
              ? "The estimated cumulative return is negative. Investigate the investment and operating costs before committing additional resources."
              : "A nonnegative cumulative return doesn't establish that the investment is worthwhile. Compare the potential return with the money at risk and other opportunities."}
        </p>
      </div>
    </section>
  );
}

// ========================================
// DEMAND DIRECTION
// ========================================

function DemandDirection({
  selectedForecast,
  predictions,
  timeframe,
}) {
  const trend =
    timeframe === "monthly"
      ? selectedForecast?.demand_trend
      : selectedForecast?.demand_change_yoy;

  const previousDemand = numeric(
    timeframe === "monthly"
      ? trend?.last_month_demand
      : trend?.last_year_demand
  );

  const currentDemand = metricValue(
    predictions?.demand_units
  );

  const comparable =
    previousDemand !== null &&
    currentDemand !== null &&
    previousDemand >= 0 &&
    currentDemand >= 0;

  const difference = comparable
    ? currentDemand - previousDemand
    : null;

  const percentage =
    comparable && previousDemand > 0
      ? (difference / previousDemand) * 100
      : null;

  const direction = String(
    trend?.direction || "Unavailable"
  );

  const comparisonLabel =
    timeframe === "monthly"
      ? "Previous month"
      : "Previous year";

  return (
    <section className="mt-14">
      <SectionHeading
        number="04"
        eyebrow="Customer demand"
        title="Is demand changing?"
        description="Review how estimated demand compares with the previous period, when figures are available."
      />

      <div className="mt-7 grid gap-5 lg:grid-cols-2">
        <article className="border border-ink bg-[#F8EEE0] p-6">
          <p className="eyebrow text-muted-foreground">
            Estimated direction
          </p>

          <p className="mt-6 font-display text-4xl capitalize">
            {direction}
          </p>

          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            This describes the expected direction
            of customer demand. It does not confirm
            that demand has already changed.
          </p>
        </article>

        <article className="border border-ink bg-card p-6">
          <p className="eyebrow text-muted-foreground">
            Demand comparison
          </p>

          {comparable ? (
            <>
              <div className="mt-6 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {comparisonLabel}
                  </p>

                  <p className="mt-3 font-display text-3xl">
                    {formatNumber(previousDemand)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">
                    Selected period
                  </p>

                  <p className="mt-3 font-display text-3xl">
                    {formatNumber(currentDemand)}
                  </p>
                </div>
              </div>

              <p className="mt-6 text-sm font-semibold">
                Estimated change:{" "}
                {difference > 0 ? "+" : ""}
                {formatNumber(difference)} units
              </p>

              {percentage !== null && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {percentage > 0 ? "+" : ""}
                  {percentage.toFixed(2)}%
                  {" compared with "}
                  {comparisonLabel.toLowerCase()}
                </p>
              )}
            </>
          ) : (
            <p className="mt-6 text-sm leading-7 text-muted-foreground">
              There isn't enough information
              to compare the two periods.
            </p>
          )}
        </article>
      </div>

      <p className="mt-5 text-sm leading-7 text-muted-foreground">
        Before changing inventory or spending,
        compare the forecast with recent sales
        and other available evidence of customer demand.
      </p>
    </section>
  );
}

// ========================================
// DETAILED BUSINESS EXPLANATIONS
// ========================================

const DETAIL_GROUPS = [
  {
    id: "pricing",
    label: "Pricing",
    heading: "Understand your selling price.",
    description:
      "See what customers may pay on average and what to check before making a pricing decision.",
  },
  {
    id: "demand",
    label: "Demand",
    heading: "Understand potential customer demand.",
    description:
      "Explore estimated interest in the product without treating projections as confirmed orders.",
  },
  {
    id: "returns",
    label: "Returns",
    heading: "Understand your potential returns.",
    description:
      "Consider how the estimated financial return compares with the investment and risk involved.",
  },
];

function SupportingMetric({
  label,
  metric,
  explanation,
  guidance,
  highlighted = false,
}) {
  const available = metricValue(metric) !== null;

  return (
    <article
      className={
        "flex min-w-0 flex-col border border-ink " +
        (highlighted
          ? "bg-[#F8EEE0] "
          : "bg-card ") +
        cardHover
      }
    >
      <div className="p-6">
        <p className="eyebrow text-muted-foreground">
          {label}
        </p>

        <p className="mt-5 break-words font-display text-4xl">
          {formatMetric(metric)}
        </p>

        <RangeText metric={metric} />
      </div>

      <div className="flex flex-1 flex-col gap-5 border-t border-border p-6">
        <div>
          <p className="text-sm font-semibold">
            What does this mean?
          </p>

          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            {available
              ? explanation
              : "An estimate isn't available for this period."}
          </p>
        </div>

        <div className="mt-auto border-l-2 border-primary pl-4">
          <p className="text-sm font-semibold">
            Before making a decision
          </p>

          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            {guidance}
          </p>
        </div>
      </div>
    </article>
  );
}

function SupportingDetails({
  predictions,
  timeframe,
}) {
  const [category, setCategory] =
    useState("pricing");

  const activeGroup =
    DETAIL_GROUPS.find(
      (group) => group.id === category
    ) || DETAIL_GROUPS[0];

  const price = metricValue(
    predictions?.avg_price
  );

  const demandShare = metricValue(
    predictions?.demand_share_pct
  );

  const periodReturn =
    timeframe === "yearly"
      ? predictions?.roi_year_pct
      : predictions?.roi_unit_pct;

  const periodReturnValue =
    metricValue(periodReturn);

  const cumulativeReturn = metricValue(
    predictions?.roi_cum_pct
  );

  const metrics = {
    pricing: [
      {
        label: "Average selling price",
        metric: predictions?.avg_price,

        explanation:
          "This is the average price the forecast expects customers to pay per unit. Individual sales may happen at different prices.",

        guidance:
          price !== null
            ? `Compare the estimated price of ${formatMoney(price)} with similar products. Check whether your actual production, delivery, and selling costs would leave enough profit.`
            : "Compare competing products and calculate your costs before deciding on a selling price.",

        highlighted: true,
      },
    ],

    demand: [
      {
        label: "Estimated demand",
        metric: predictions?.demand_units,

        explanation:
          "This estimates how many units customers might want during the selected period. It does not represent confirmed purchases or orders.",

        guidance:
          "Compare this estimate with available sales history, customer feedback, and competitor activity. Avoid purchasing inventory solely because of the forecast.",

        highlighted: true,
      },

      {
        label: "Share of category demand",
        metric: predictions?.demand_share_pct,

        explanation:
          "This estimates the product's portion of demand within its category. It does not confirm how much market share the product will actually capture.",

        guidance:
          demandShare !== null
            ? "Compare the product with competitors on price, features, quality, and customer feedback. Look for evidence that customers would choose this product over alternatives."
            : "Research competing products and customer preferences before assuming the product can attract a meaningful share of demand.",
      },
    ],

    returns: [
      {
        label:
          timeframe === "yearly"
            ? "Annual return on investment"
            : "Return on investment per unit",

        metric: periodReturn,

        explanation:
          timeframe === "yearly"
            ? "This estimates the return associated with the selected year relative to the investment used in the forecast. It is not a guaranteed return."
            : "This estimates the return associated with selling one unit relative to the investment used in the forecast. It is not a guaranteed return.",

        guidance:
          periodReturnValue !== null &&
          periodReturnValue < 0
            ? "The estimated return is negative. Examine your costs, selling price, and expected sales before considering additional investment."
            : "Decide whether the potential return would justify the investment. Consider the possibility that actual results could be lower than estimated.",

        highlighted: true,
      },

      {
        label: "Cumulative return on investment",
        metric: predictions?.roi_cum_pct,

        explanation:
          "This estimates the overall return accumulated through the selected period. It is different from the return for one month, one year, or one unit.",

        guidance:
          cumulativeReturn !== null &&
          cumulativeReturn < 0
            ? "The estimated cumulative return is negative. Review the investment assumptions and consider what would need to change before investing further."
            : "Compare the estimated overall return with your investment goals and financial risk. A positive estimate alone is not enough to establish that the opportunity is worthwhile.",
      },
    ],
  };

  return (
    <section className="mt-14">
      <SectionHeading
        number="05"
        eyebrow="More details"
        title="Understand what the numbers mean."
        description="Explore pricing, demand, and financial returns, with clear explanations and considerations for your next business decision."
      />

      <div
        role="group"
        aria-label="Forecast detail category"
        className="mt-7 flex flex-wrap gap-2"
      >
        {DETAIL_GROUPS.map((group) => (
          <button
            key={group.id}
            type="button"
            onClick={() => setCategory(group.id)}
            aria-pressed={category === group.id}
            className={
              "border border-ink px-5 py-3 text-sm font-semibold transition-colors " +
              (category === group.id
                ? "bg-primary text-primary-foreground shadow-offset"
                : "bg-card hover:bg-[#F8EEE0]")
            }
          >
            {group.label}
          </button>
        ))}
      </div>

      <div className="mt-7 border border-ink bg-[#F8EEE0] p-6">
        <h3 className="font-display text-2xl">
          {activeGroup.heading}
        </h3>

        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          {activeGroup.description}
        </p>
      </div>

      <div className="mt-5 grid items-stretch gap-5 md:grid-cols-2">
        {metrics[category].map((item) => (
          <SupportingMetric
            key={`${category}-${item.label}`}
            {...item}
          />
        ))}
      </div>
    </section>
  );
}

// ========================================
// FORECAST INFORMATION
// ========================================

function ForecastContext({
  selectedForecast,
  timeframe,
  period,
  productId,
}) {
  const details = [
    {
      label: "Forecast type",
      value:
        timeframe === "monthly"
          ? "Monthly"
          : "Yearly",
    },
    {
      label: "Forecast period",
      value: formatPeriod(period),
    },
  ];

  if (
    timeframe === "monthly" &&
    selectedForecast?.promo_depth_pct != null
  ) {
    details.push({
      label: "Expected promotion discount",
      value: `${selectedForecast.promo_depth_pct}%`,
    });
  }

  if (
    timeframe === "monthly" &&
    selectedForecast?.promo_source
  ) {
    details.push({
      label: "Promotion assumption",
      value: selectedForecast.promo_source,
    });
  }

  if (productId) {
    details.push({
      label: "Product reference",
      value: String(productId),
    });
  }

  return (
    <section className="mt-14">
      <SectionHeading
        number="06"
        eyebrow="Forecast information"
        title="What's included in this estimate?"
        description="Review the selected period and the available information used to describe these results."
      />

      <div className="mt-7 grid gap-4 sm:grid-cols-2">
        {details.map((detail) => (
          <article
            key={detail.label}
            className="min-w-0 border border-ink bg-card p-5"
          >
            <p className="eyebrow text-muted-foreground">
              {detail.label}
            </p>

            <p className="mt-4 break-words font-display text-xl">
              {detail.value}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

// ========================================
// NEXT BUSINESS DECISIONS
// ========================================

function DecisionGuidance({
  predictions,
  timeframe,
}) {
  const profit = metricValue(
    predictions?.net_profit
  );

  const revenue = metricValue(
    predictions?.gross_revenue
  );

  const price = metricValue(
    predictions?.avg_price
  );

  const periodLabel =
    timeframe === "monthly"
      ? "month"
      : "year";

  const steps = [
    {
      title: "Review your costs and profit",

      description:
        profit !== null && profit < 0
          ? `The forecast estimates a loss of ${formatMoney(Math.abs(profit))} for the selected ${periodLabel}. Check whether pricing, product costs, or other expenses could explain the result.`
          : profit !== null && profit > 0
            ? `The estimated net profit is ${formatMoney(profit)}. Compare this with your actual expenses and decide whether that potential profit would justify the investment.`
            : revenue !== null
              ? "Review the expenses behind the revenue estimate to understand whether the product could generate a worthwhile profit."
              : "Collect reliable cost and pricing information before making a financial decision.",
    },

    {
      title: "Check customer demand",

      description:
        "Use available sales history, customer feedback, and competitor research to assess whether the demand estimate is realistic. Remember that projected demand does not guarantee sales.",
    },

    {
      title: "Review your pricing strategy",

      description:
        price !== null
          ? `The estimated average selling price is ${formatMoney(price)}. Compare it with competitor prices and your actual costs before deciding whether to change your price or promotions.`
          : "Compare similar products and calculate your costs before setting prices or offering discounts.",
    },
  ];

  return (
    <section className="mt-14">
      <SectionHeading
        number="07"
        eyebrow="Your next decisions"
        title="What should you review before deciding?"
        description="Use these suggestions to identify what needs further research. They are not recommendations to invest or guarantees of success."
      />

      <div className="mt-7 border border-ink bg-card p-6 shadow-offset sm:p-8">
        <div className="space-y-6">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className="flex items-start gap-4 border-b border-border pb-6 last:border-b-0 last:pb-0"
            >
              <span className="flex size-9 shrink-0 items-center justify-center border border-ink bg-[#F8EEE0] font-mono text-xs">
                {String(index + 1).padStart(2, "0")}
              </span>

              <div>
                <h3 className="text-sm font-semibold">
                  {step.title}
                </h3>

                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ========================================
// ABOUT FORECAST
// ========================================

function AboutForecast({ notes }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="About this forecast"
        className="fixed bottom-6 right-6 z-40 flex size-12 items-center justify-center border border-ink bg-primary text-primary-foreground shadow-offset"
      >
        <Info size={21} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-end p-4 sm:p-6">
          <button
            type="button"
            aria-label="Close forecast information"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-foreground/45"
          />

          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="forecast-info-title"
            className="relative z-10 max-h-[85vh] w-full max-w-md overflow-y-auto border border-ink bg-card p-6 shadow-offset sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <h2
                id="forecast-info-title"
                className="font-display text-3xl"
              >
                About this forecast
              </h2>

              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-lg"
              >
                ×
              </button>
            </div>

            <p className="mt-6 text-sm leading-7 text-muted-foreground">
              These figures are estimates for
              the selected period, not confirmed
              business outcomes.
            </p>

            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              Some figures use simulated market
              and financial information. Actual
              sales, costs, and profits may differ.
            </p>

            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              Estimated ranges describe uncertainty
              in the forecasts. They are not
              guaranteed minimum or maximum results.
            </p>

            {Array.isArray(notes) &&
              notes.length > 0 && (
                <div className="mt-6 border-l-2 border-primary bg-[#F8EEE0] p-4">
                  <p className="text-sm font-semibold">
                    Additional information
                  </p>

                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
                    {notes.map((note, index) => (
                      <li key={index}>
                        {note}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            <button
              type="button"
              onClick={() => setOpen(false)}
              className={`mt-7 w-full ${primaryButton}`}
            >
              Got it
            </button>
          </section>
        </div>
      )}
    </>
  );
}

// ========================================
// MAIN PAGE
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

  const hasForecast = Boolean(
    monthly || yearly
  );

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

  // ========================================
  // EMPTY STATE
  // ========================================

  if (!hasForecast) {
    return (
      <main className="min-h-screen bg-background px-6 py-20 text-center text-foreground">
        <h1 className="font-display text-4xl">
          No sales forecast available.
        </h1>

        <p className="mt-4 text-sm text-muted-foreground">
          Select an existing product to explore
          estimated sales and financial performance.
        </p>

        <Link
          to="/discover"
          className={`mt-8 ${primaryButton}`}
        >
          Discover products
          <ArrowRight size={18} />
        </Link>
      </main>
    );
  }

  // ========================================
  // PAGE CONTENT
  // ========================================

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-5 pb-24 pt-12 sm:px-8 lg:pt-16">
        <Link
          to="/discover"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft size={16} />
          Back to Discovery
        </Link>

        <header className="mt-10 border-b border-ink pb-10">
          <p className="eyebrow flex items-center gap-3 text-muted-foreground">
            <span className="text-primary">
              02
            </span>

            <span className="h-px w-8 bg-current" />

            Sales forecasting
          </p>

          <h1 className="mt-6 font-display text-5xl leading-tight sm:text-6xl">
            Your sales{" "}
            <em className="text-primary">
              outlook.
            </em>
          </h1>

          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Explore estimated sales, demand,
            and profitability for an existing product.
          </p>

          <div className="mt-8 border-l-2 border-primary pl-5">
            <p className="eyebrow text-muted-foreground">
              Existing product
            </p>

            <h2 className="mt-2 break-words font-display text-2xl">
              {productName}
            </h2>
          </div>
        </header>

        {/* FORECAST TIMEFRAME */}

        <section className="mt-10 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow text-primary">
              Forecast period
            </p>

            <p className="mt-3 font-display text-2xl">
              {formatPeriod(period)}
            </p>
          </div>

          <div
            role="group"
            aria-label="Forecast timeframe"
            className="flex border border-ink bg-card p-1"
          >
            <button
              type="button"
              disabled={!monthly}
              aria-pressed={
                activeTimeframe === "monthly"
              }
              onClick={() =>
                setTimeframe("monthly")
              }
              className={
                "px-5 py-3 text-sm font-semibold transition-colors disabled:opacity-40 " +
                (activeTimeframe === "monthly"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-[#F8EEE0]")
              }
            >
              Monthly
            </button>

            <button
              type="button"
              disabled={!yearly}
              aria-pressed={
                activeTimeframe === "yearly"
              }
              onClick={() =>
                setTimeframe("yearly")
              }
              className={
                "px-5 py-3 text-sm font-semibold transition-colors disabled:opacity-40 " +
                (activeTimeframe === "yearly"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-[#F8EEE0]")
              }
            >
              Yearly
            </button>
          </div>
        </section>

        {predictions ? (
          <>
            {/* FINANCIAL RESULTS */}

            <section className="mt-12">
              <SectionHeading
                number="01"
                eyebrow="Financial outlook"
                title="What could this product earn?"
                description={`Estimated results for ${formatPeriod(period)}. These figures can help you evaluate potential sales and profitability.`}
              />

              <div className="mt-7 grid gap-5 md:grid-cols-3">
                <MetricCard
                  label="Gross revenue"
                  metric={predictions.gross_revenue}
                  description="Estimated sales revenue before costs."
                  highlighted
                />

                <MetricCard
                  label="Net profit"
                  metric={predictions.net_profit}
                  description="Estimated earnings after costs."
                />

                <MetricCard
                  label="Units sold"
                  metric={predictions.units_sold}
                  description="Estimated sales volume, not confirmed orders."
                />
              </div>
            </section>

            {/* MAIN TAKEAWAY */}

            <section className="mt-6 border-l-2 border-primary bg-[#F8EEE0] p-6">
              <p className="font-semibold">
                What do these results suggest?
              </p>

              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                {metricValue(predictions.net_profit) === null
                  ? "A profit estimate isn't available for this period. Review pricing, costs, and sales assumptions before making a decision."
                  : metricValue(predictions.net_profit) < 0
                    ? `The forecast suggests a potential loss of ${formatMoney(Math.abs(metricValue(predictions.net_profit)))} for ${formatPeriod(period)}. Review estimated costs and pricing before making an investment decision.`
                    : metricValue(predictions.net_profit) > 0
                      ? `The forecast suggests potential net profit of ${formatMoney(metricValue(predictions.net_profit))} for ${formatPeriod(period)}. Check whether actual expenses and customer purchases would support that result.`
                      : "The forecast suggests that revenue and expenses could be approximately equal. Review costs and pricing before deciding whether to proceed."}
              </p>
            </section>

            {/* CHARTS */}

            <section className="mt-14">
              <SectionHeading
                number="02"
                eyebrow="Visual comparisons"
                title="See the bigger picture."
                description="Compare estimated revenue with costs, and projected sales with potential customer demand."
              />

              <div className="mt-7 grid items-stretch gap-5 lg:grid-cols-2">
                <ChartPanel
                  title="Where could the revenue go?"
                  description="Compare estimated revenue with costs calculated from the forecast."
                >
                  <FinancialChart
                    predictions={predictions}
                  />
                </ChartPanel>

                <ChartPanel
                  title="How do sales and demand compare?"
                  description="These projections describe possible outcomes, not confirmed customer purchases."
                >
                  <DemandChart
                    predictions={predictions}
                  />
                </ChartPanel>
              </div>
            </section>

            {/* PROFITABILITY */}

            <ProfitabilitySection
              key={`profit-${productId}-${activeTimeframe}`}
              predictions={predictions}
              timeframe={activeTimeframe}
            />

            {/* DEMAND DIRECTION */}

            <DemandDirection
              key={`demand-${productId}-${activeTimeframe}`}
              selectedForecast={selectedForecast}
              predictions={predictions}
              timeframe={activeTimeframe}
            />

            {/* ADDITIONAL DETAILS */}

            <SupportingDetails
              key={`details-${productId}-${activeTimeframe}`}
              predictions={predictions}
              timeframe={activeTimeframe}
            />

            {/* FORECAST INFORMATION */}

            <ForecastContext
              selectedForecast={selectedForecast}
              timeframe={activeTimeframe}
              period={period}
              productId={productId}
            />

            {/* DECISION GUIDANCE */}

            <DecisionGuidance
              predictions={predictions}
              timeframe={activeTimeframe}
            />
          </>
        ) : (
          <section className="mt-12 border border-ink bg-card p-6">
            <p className="text-sm text-muted-foreground">
              Forecast figures are unavailable
              for this period.
            </p>
          </section>
        )}

        {/* NAVIGATION */}

        <section className="mt-14 flex flex-col items-start justify-between gap-5 border-t border-ink pt-8 sm:flex-row sm:items-center">
          <div>
            <p className="eyebrow text-primary">
              Continue exploring
            </p>

            <h2 className="mt-3 font-display text-2xl">
              Have another product in mind?
            </h2>

            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              Compare different products before
              making your next business decision.
            </p>
          </div>

          <Link
            to="/discover"
            className={primaryButton}
          >
            Forecast another product
            <ArrowRight size={18} />
          </Link>
        </section>

        <AboutForecast
          notes={selectedForecast?.notes}
        />

        <div className="mt-8 flex items-start gap-2 text-xs leading-6 text-muted-foreground">
          <CircleHelp
            size={15}
            className="mt-0.5 shrink-0"
          />

          <span>
            These forecasts are estimates for
            business research, not guarantees
            of sales, profit, or investment returns.
          </span>
        </div>
      </div>
    </main>
  );
}
