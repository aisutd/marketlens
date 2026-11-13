
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  ChartNoAxesCombined,
  ChevronRight,
  CircleDollarSign,
  Menu,
  ScanSearch,
  SearchCheck,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  X,
} from "lucide-react";

import TryItLive from "../components/TryItLive";

const ticker = [
  "Market Intelligence",
  "Predictive Analytics",
  "Revenue Forecasting",
  "Opportunity Analysis",
  "Pricing Strategy",
  "Risk Assessment",
  "Financial Projections",
  "Decision Intelligence",
];

const example = {
  title: "Reusable Silicone Food Storage Bags, 10 Pack, Leakproof",
  category: "Kitchen & Dining",
  price: 14.99,
  listPrice: 19.99,
  score: 70,
  up: [
    {
      feature: "title_score",
      label: "Product description",
      impact: 0.516,
    },
    {
      feature: "brand_cat_rate",
      label: "Category performance",
      impact: 0.446,
    },
    {
      feature: "discount_pct",
      label: "Pricing",
      impact: 0.361,
    },
  ],
  down: [
    {
      feature: "category_id",
      label: "Market conditions",
      impact: -0.523,
    },
    {
      feature: "title_emb",
      label: "Product positioning",
      impact: -0.247,
    },
    {
      feature: "brand_cats",
      label: "Brand presence",
      impact: -0.046,
    },
  ],
};

const benefits = [
  {
    number: "01",
    icon: Target,
    title: "Identify opportunities",
    description:
      "Evaluate product ideas and identify promising opportunities before committing resources.",
  },
  {
    number: "02",
    icon: ChartNoAxesCombined,
    title: "Understand demand",
    description:
      "Explore product performance and demand projections to support more informed decisions.",
  },
  {
    number: "03",
    icon: SlidersHorizontal,
    title: "Evaluate pricing",
    description:
      "Compare different price points and understand how pricing may influence a product's opportunity score.",
  },
  {
    number: "04",
    icon: ShieldCheck,
    title: "Assess potential risks",
    description:
      "Identify important factors that could affect product performance and areas that deserve further research.",
  },
  {
    number: "05",
    icon: CircleDollarSign,
    title: "Forecast financial outcomes",
    description:
      "Explore projected sales, revenue, profitability, and other financial indicators.",
  },
  {
    number: "06",
    icon: BarChart3,
    title: "Make informed decisions",
    description:
      "Bring product research, analytical insights, and financial projections together in one workspace.",
  },
];

const forecasts = [
  {
    number: "01",
    title: "Launch planning",
    description:
      "Explore potential sales, revenue, profit, and break-even outcomes for a new product.",
  },
  {
    number: "02",
    title: "Monthly projections",
    description:
      "Review expected performance over shorter time horizons and explore changes in demand.",
  },
  {
    number: "03",
    title: "Annual outlook",
    description:
      "Evaluate longer-term projections to help inform product and financial planning.",
  },
];

const decisionSteps = [
  {
    icon: SearchCheck,
    title: "Research",
    description: "Explore the product opportunity.",
  },
  {
    icon: ChartNoAxesCombined,
    title: "Analyze",
    description: "Understand the factors behind the results.",
  },
  {
    icon: CircleDollarSign,
    title: "Forecast",
    description: "Evaluate potential financial outcomes.",
  },
  {
    icon: Target,
    title: "Decide",
    description: "Use the insights to guide your next steps.",
  },
];

const DISCLAIMER =
  "MarketLens provides AI-generated analyses, predictions, and estimates " +
  "for informational purposes only. Results may vary and should not be " +
  "relied upon as the sole basis for business, financial, or investment decisions.";

/*
 * Shared informational-card hover design.
 *
 * All landing page cards use the same:
 * - warm beige background
 * - dark offset shadow
 * - subtle upward movement
 * - transition timing
 *
 * Cards remain informational rather than clickable.
 */
const cardHover =
  "relative bg-card " +
  "transition-[background-color,box-shadow,transform] " +
  "duration-200 ease-out " +
  "hover:z-10 hover:-translate-y-[2px] " +
  "hover:bg-[#F8EEE0] " +
  "hover:shadow-[4px_4px_0_0_#1D150F] " +
  "motion-reduce:transform-none " +
  "motion-reduce:transition-none";

function PrimaryButton({
  children,
  to = "/discover",
  className = "",
}) {
  return (
    <Link
      to={to}
      className={
        "inline-flex items-center justify-center gap-2 " +
        "rounded-md border border-ink bg-primary px-6 py-3 " +
        "text-sm font-medium text-primary-foreground " +
        "shadow-offset transition-all duration-150 " +
        "hover:translate-x-[2px] hover:translate-y-[2px] " +
        "hover:shadow-offset-sm " +
        "focus-visible:outline-2 focus-visible:outline-offset-4 " +
        "focus-visible:outline-primary " +
        className
      }
    >
      {children}
    </Link>
  );
}

function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  const navigation = [
    ["How it works", "#how"],
    ["Try it", "#try"],
    ["Capabilities", "#capabilities"],
    ["Forecasting", "#forecast"],
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-ink bg-background">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link
          to="/"
          aria-label="MarketLens home"
          className="flex items-center gap-2"
        >
          <span className="flex size-8 items-center justify-center rounded-full border border-ink bg-primary text-primary-foreground">
            <ScanSearch className="size-4" />
          </span>

          <span className="font-display text-xl">
            MarketLens
          </span>
        </Link>

        <nav
          aria-label="Landing navigation"
          className="hidden items-center gap-7 text-sm text-muted-foreground md:flex"
        >
          {navigation.map(([label, href]) => (
            <a
              key={href}
              href={href}
              className="transition-colors hover:text-foreground"
            >
              {label}
            </a>
          ))}
        </nav>

        <Link
          to="/discover"
          className="hidden items-center gap-2 rounded-md border border-ink bg-ink px-4 py-2 text-sm font-medium text-ink-foreground shadow-offset-sm transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none md:inline-flex"
        >
          Get Started
          <ArrowRight size={16} />
        </Link>

        <button
          type="button"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="landing-mobile-menu"
          onClick={() => setMenuOpen(!menuOpen)}
          className="border border-ink p-2 md:hidden"
        >
          {menuOpen ? <X size={19} /> : <Menu size={19} />}
        </button>
      </div>

      {menuOpen && (
        <nav
          id="landing-mobile-menu"
          aria-label="Mobile navigation"
          className="flex flex-col gap-4 border-t border-ink bg-card px-6 py-5 text-sm md:hidden"
        >
          {navigation.map(([label, href]) => (
            <a
              key={href}
              href={href}
              onClick={() => setMenuOpen(false)}
            >
              {label}
            </a>
          ))}

          <Link
            to="/discover"
            onClick={() => setMenuOpen(false)}
            className="inline-flex items-center gap-2 border-t border-border pt-4 font-medium text-primary"
          >
            Get Started
            <ArrowRight size={16} />
          </Link>
        </nav>
      )}
    </header>
  );
}

function SectionHead({
  index,
  eyebrow,
  title,
  lede,
  tone = "paper",
}) {
  const muted =
    tone === "ink"
      ? "text-ink-muted"
      : "text-muted-foreground";

  return (
    <div className="max-w-2xl">
      <p className={`eyebrow flex items-center gap-3 ${muted}`}>
        <span className="text-primary">{index}</span>
        <span className="h-px w-8 bg-current" />
        {eyebrow}
      </p>

      <h2 className="mt-5 font-display text-4xl leading-[1.02] sm:text-5xl">
        {title}
      </h2>

      <p className={`mt-5 text-lg leading-relaxed ${muted}`}>
        {lede}
      </p>
    </div>
  );
}

function ScoreDial({
  score,
  caption = "out of 100",
}) {
  const value = Math.max(
    0,
    Math.min(100, Number(score) || 0)
  );

  return (
    <div className="relative">
      <svg
        viewBox="0 0 200 116"
        className="w-full"
        role="img"
        aria-label={`Example opportunity score ${value} out of 100`}
      >
        {Array.from({ length: 11 }, (_, i) => {
          const tick = i * 10;
          const angle = Math.PI - (tick / 100) * Math.PI;
          const inner = tick % 50 === 0 ? 82 : 86;

          return (
            <line
              key={tick}
              x1={100 + 92 * Math.cos(angle)}
              y1={104 - 92 * Math.sin(angle)}
              x2={100 + inner * Math.cos(angle)}
              y2={104 - inner * Math.sin(angle)}
              className="stroke-muted-foreground"
              strokeWidth={1}
            />
          );
        })}

        <path
          d="M 24 104 A 76 76 0 0 1 176 104"
          fill="none"
          className="stroke-secondary"
          strokeWidth={12}
        />

        <path
          d="M 24 104 A 76 76 0 0 1 176 104"
          fill="none"
          pathLength={100}
          strokeDasharray="100"
          strokeDashoffset={100 - value}
          className="stroke-primary animate-sweep"
          style={{ "--dash-from": 100 }}
          strokeWidth={12}
        />
      </svg>

      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
        <span className="font-display tabular text-6xl leading-none">
          {value}
        </span>

        <span className="eyebrow mt-2 text-muted-foreground">
          {caption}
        </span>
      </div>
    </div>
  );
}

function ReasonBars({ up, down }) {
  const maximum = Math.max(
    0.0001,
    ...[...up, ...down].map((r) => Math.abs(r.impact))
  );

  function renderGroup(items, positive) {
    const color = positive
      ? "text-signal-up"
      : "text-signal-down";

    const fill = positive
      ? "bg-signal-up"
      : "bg-signal-down";

    return (
      <div>
        <p className={`eyebrow mb-3 flex items-center gap-1.5 ${color}`}>
          {positive ? (
            <ArrowUpRight size={14} />
          ) : (
            <ArrowDownRight size={14} />
          )}

          {positive ? "Positive factors" : "Negative factors"}
        </p>

        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.feature}
              className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1"
            >
              <span className="truncate text-sm">
                {item.label}
              </span>

              <span className={`font-mono tabular text-xs ${color}`}>
                {positive ? "+" : "−"}
                {Math.abs(item.impact).toFixed(2)}
              </span>

              <div className="col-span-2 h-1.5 bg-secondary">
                <div
                  className={`h-full ${fill}`}
                  style={{
                    width: `${
                      (Math.abs(item.impact) / maximum) * 100
                    }%`,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {renderGroup(up, true)}
      {renderGroup(down, false)}
    </div>
  );
}

function HeroCard() {
  return (
    <div className="relative">
      <div className="absolute -bottom-4 -left-4 z-10 -rotate-2 border border-ink bg-accent px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-accent-foreground shadow-offset-sm">
        Illustrative example
      </div>

      <div className="border border-ink bg-card shadow-offset">
        <div className="flex items-center justify-between border-b border-ink px-5 py-3">
          <span className="eyebrow text-muted-foreground">
            Product opportunity
          </span>

          <span className="font-mono text-[11px] text-muted-foreground">
            Analysis preview
          </span>
        </div>

        <div className="space-y-1 px-5 pt-5">
          <p className="text-[15px] font-medium leading-snug">
            {example.title}
          </p>

          <p className="font-mono text-xs text-muted-foreground">
            {example.category} · ${example.price}{" "}
            <span className="line-through">
              ${example.listPrice}
            </span>
          </p>
        </div>

        <div className="px-10 pb-2 pt-4">
          <ScoreDial score={example.score} />
        </div>

        <p className="px-5 pb-5 text-center text-sm text-muted-foreground">
          Illustrative opportunity score:{" "}
          <span className="font-medium text-foreground">
            70/100
          </span>
        </p>

        <div className="border-t border-dashed border-border px-5 py-5">
          <ReasonBars up={example.up} down={example.down} />
        </div>
      </div>
    </div>
  );
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden border-b border-ink bg-ledger">
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 pb-20 pt-14 sm:px-8 lg:grid-cols-[1.15fr_1fr] lg:pb-24 lg:pt-20">
        <div className="animate-rise">
          <p className="eyebrow mb-6 inline-flex items-center gap-2 border border-ink bg-card px-3 py-1.5">
            <span className="size-1.5 rounded-full bg-primary" />
            Product intelligence platform
          </p>

          <h1 className="font-display text-5xl leading-[0.95] sm:text-6xl lg:text-7xl">
            Know if it'll sell{" "}
            <em className="text-primary">
              before
            </em>{" "}
            you source it.
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Evaluate product opportunities, understand market factors,
            and forecast financial performance — all in one platform
            designed to help you make more informed business decisions.
          </p>

          <div className="mt-9 flex flex-wrap gap-4">
            <a
              href="#try"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-ink bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-offset transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-offset-sm"
            >
              Score a quick Idea
              <ArrowRight size={18} />
            </a>

            <Link
              to="/discover"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-ink bg-card px-6 py-3 text-sm font-medium text-foreground shadow-offset-sm transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
            >
              Explore MarketLens
              <ChevronRight size={18} />
            </Link>
          </div>

          <div className="mt-12 grid max-w-lg grid-cols-3 gap-4 border-t border-ink pt-5">
            {[
              ["01", "Evaluate ideas"],
              ["02", "Explore insights"],
              ["03", "Forecast outcomes"],
            ].map(([number, label]) => (
              <div key={number}>
                <p className="font-display text-3xl text-primary">
                  {number}
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="animate-rise mx-auto w-full max-w-md [animation-delay:150ms]">
          <HeroCard />
        </div>
      </div>
    </section>
  );
}

function TechnicalTicker() {
  return (
    <div
      aria-label="MarketLens product capabilities"
      className="overflow-hidden border-b border-ink bg-ink py-3 text-ink-foreground"
    >
      <div className="flex w-max animate-marquee gap-10 whitespace-nowrap font-mono text-xs uppercase tracking-[0.18em]">
        {[...ticker, ...ticker].map((item, index) => (
          <span
            key={`${item}-${index}`}
            aria-hidden={index >= ticker.length ? "true" : undefined}
            className="flex items-center gap-10"
          >
            {item}

            <span aria-hidden="true" className="text-primary">
              ✦
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    {
      number: "A",
      title: "Describe your product",
      description:
        "Start with a product idea. Enter its name, category, and pricing information to begin evaluating its market potential.",
    },
    {
      number: "B",
      title: "Explore the opportunity",
      description:
        "Review an opportunity score and identify the product characteristics influencing its assessment.",
    },
    {
      number: "C",
      title: "Plan your next move",
      description:
        "Use market insights, pricing analysis, and financial forecasts to support your product strategy.",
    },
  ];

  return (
    <section
      id="how"
      className="mx-auto max-w-6xl scroll-mt-20 px-5 py-24 sm:px-8"
    >
      <SectionHead
        index="01"
        eyebrow="How it works"
        title="From product idea to informed decision."
        lede="MarketLens makes it easier to evaluate opportunities and explore potential business outcomes before making your next move."
      />

      <div className="mt-14 grid gap-px border border-ink bg-ink md:grid-cols-3">
        {steps.map((step) => (
          <article
            key={step.number}
            className={`${cardHover} p-7`}
          >
            <span className="font-display text-5xl text-primary">
              {step.number}
            </span>

            <h3 className="mt-5 text-lg font-semibold">
              {step.title}
            </h3>

            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {step.description}
            </p>
          </article>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-5 border-t border-border pt-7">
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
          Whether you're exploring a new product idea or evaluating
          an existing product, MarketLens helps organize your
          research and analysis.
        </p>

        <Link
          to="/discover"
          className="inline-flex items-center gap-2 text-sm font-semibold text-foreground transition-colors hover:text-primary"
        >
          Explore product discovery
          <ArrowRight size={17} />
        </Link>
      </div>
    </section>
  );
}

function TryItSection() {
  return (
    <section
      id="try"
      className="scroll-mt-16 border-y border-ink bg-ink bg-ledger-ink py-24 text-ink-foreground"
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHead
          tone="ink"
          index="02"
          eyebrow="Try it live"
          title="Score a product idea right now."
          lede="Choose an example or enter your own product information to explore its opportunity score."
        />

        <div className="mt-12">
          <TryItLive />
        </div>
      </div>
    </section>
  );
}

function CapabilitiesSection() {
  return (
    <section
      id="capabilities"
      className="mx-auto max-w-6xl scroll-mt-20 px-5 py-24 sm:px-8"
    >
      <SectionHead
        index="03"
        eyebrow="Platform capabilities"
        title="Everything you need to explore an opportunity."
        lede="Bring together product evaluation, market insights, and financial analysis to better understand the potential of your next product."
      />

      <div className="mt-14 grid gap-px border border-ink bg-ink sm:grid-cols-2 lg:grid-cols-3">
        {benefits.map((benefit) => {
          const Icon = benefit.icon;

          return (
            <article
              key={benefit.number}
              className={`${cardHover} flex min-h-[250px] flex-col p-7`}
            >
              <div className="flex items-start justify-between gap-4">
                <span className="flex size-11 items-center justify-center border border-ink bg-secondary">
                  <Icon
                    size={21}
                    strokeWidth={1.6}
                    aria-hidden="true"
                  />
                </span>

                <span className="font-mono text-xs text-muted-foreground">
                  {benefit.number}
                </span>
              </div>

              <h3 className="mt-7 font-display text-2xl leading-tight">
                {benefit.title}
              </h3>

              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {benefit.description}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ForecastSection() {
  return (
    <section
      id="forecast"
      className="scroll-mt-20 border-y border-ink bg-secondary"
    >
      <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
        <div className="grid items-start gap-12 lg:grid-cols-[1fr_1fr]">
          <div>
            <SectionHead
              index="04"
              eyebrow="Financial forecasting"
              title="Look beyond the opportunity score."
              lede="Understanding market potential is only part of the decision. Explore financial projections to assess what a product could mean for your business."
            />

            <Link
              to="/discover"
              className="mt-9 inline-flex items-center gap-2 text-sm font-semibold text-foreground transition-colors hover:text-primary"
            >
              Explore forecasting
              <ArrowRight size={17} />
            </Link>
          </div>

          <div className="border border-ink bg-card shadow-offset-sm">
            <div className="flex items-center justify-between border-b border-ink px-5 py-3">
              <span className="eyebrow text-muted-foreground">
                Financial outlook
              </span>

              <span className="font-mono text-[11px] text-muted-foreground">
                Planning tools
              </span>
            </div>

            <div className="divide-y divide-border">
              {forecasts.map((item) => (
                <article
                  key={item.number}
                  className={`${cardHover} grid grid-cols-[2.5rem_1fr] gap-4 px-6 py-6`}
                >
                  <span className="font-mono text-xs text-primary">
                    {item.number}
                  </span>

                  <div>
                    <h3 className="text-base font-semibold">
                      {item.title}
                    </h3>

                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function DecisionSection() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
      <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="eyebrow flex items-center gap-3 text-muted-foreground">
            <span className="text-primary">05</span>
            <span className="h-px w-8 bg-current" />
            Business intelligence
          </p>

          <h2 className="mt-5 max-w-xl font-display text-4xl leading-[1.02] sm:text-5xl">
            Less guesswork. More informed decisions.
          </h2>

          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Every product decision involves uncertainty.
            MarketLens helps you evaluate opportunities,
            understand key factors, and explore potential
            outcomes in one place.
          </p>

          <div className="mt-9">
            <PrimaryButton>
              Start exploring
              <ArrowRight size={18} />
            </PrimaryButton>
          </div>
        </div>

        <div className="self-center border border-ink bg-card shadow-offset">
          <div className="border-b border-ink px-5 py-3">
            <span className="eyebrow text-muted-foreground">
              Your decision workspace
            </span>
          </div>

          <div className="divide-y divide-border">
            {decisionSteps.map((item, index) => {
              const Icon = item.icon;

              return (
                <article
                  key={item.title}
                  className={`${cardHover} flex items-start gap-4 p-5`}
                >
                  <span className="flex size-10 shrink-0 items-center justify-center border border-border bg-secondary">
                    <Icon
                      size={19}
                      strokeWidth={1.7}
                      aria-hidden="true"
                    />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-medium">
                        {item.title}
                      </h3>

                      <span className="font-mono text-[11px] text-muted-foreground">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </div>

                    <p className="mt-1 text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function LandingFooter() {
  return (
    <footer className="border-t border-ink bg-ink text-ink-foreground">
      <div className="mx-auto max-w-6xl px-5 pt-20 pb-8 sm:px-8">
        <div className="flex flex-col items-start justify-between gap-10 md:flex-row md:items-end">
          <div>
            <p className="eyebrow text-ink-muted">
              Your next opportunity starts here
            </p>

            <h2 className="mt-4 max-w-2xl font-display text-4xl leading-tight sm:text-5xl">
              Turn your next product idea into an informed decision.
            </h2>
          </div>

          <PrimaryButton>
            Get Started
            <ArrowRight size={18} />
          </PrimaryButton>
        </div>

        <div className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-ink-border pt-6 font-mono text-xs text-ink-muted">
          <span className="flex items-center gap-2">
            <ScanSearch className="size-4 text-primary" />
            MarketLens
          </span>

          <span>
            © {new Date().getFullYear()} MarketLens.
            All rights reserved.
          </span>
        </div>

        <div className="mt-8 border-t border-ink-border pt-6">
          <p className="max-w-4xl text-xs leading-relaxed text-ink-muted">
            <span className="font-semibold text-ink-foreground">
              Disclaimer:
            </span>{" "}
            {DISCLAIMER}
          </p>
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <HeroSection />
      <TechnicalTicker />
      <HowItWorks />
      <TryItSection />
      <CapabilitiesSection />
      <ForecastSection />
      <DecisionSection />
      <LandingFooter />
    </main>
  );
}
