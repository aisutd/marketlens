
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
} from "motion/react";

import {
  ArrowRight,
  ArrowLeft,
  BarChart3,
  TrendingUp,
  UsersRound,
  MessageCircle,
  Calculator,
  Lightbulb,
  Search,
  Menu,
  X,
  CheckCircle2,
  Target,
  ShieldCheck,
  BrainCircuit,
  ChevronDown,
  DollarSign,
  Wallet,
} from "lucide-react";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

import MarketLensLogo from "../components/MarketLensLogo";

// ========================================
// LANDING PAGE DATA
// ========================================

const features = [
  {
    id: "opportunity",
    icon: BarChart3,
    title: "Opportunity Scoring",
    description:
      "Evaluate product potential with intelligent market scoring.",
    details:
      "Explore an AI-generated Product Opportunity Score based on product characteristics and market signals.",
    highlights: [
      "Product Opportunity Score",
      "Positive and negative score factors",
      "Pricing What-If scenarios",
    ],
    available: true,
  },
  {
    id: "forecast",
    icon: TrendingUp,
    title: "Sales Forecasting",
    description:
      "Predict demand and explore future sales trends.",
    details:
      "Forecast financial performance using the MarketLens Sales Forecasting model.",
    highlights: [
      "Existing product monthly forecasts",
      "Existing product yearly forecasts",
      "New product launch forecasts",
    ],
    available: true,
  },
  {
    id: "competitor",
    icon: UsersRound,
    title: "Competitor Analysis",
    description:
      "Understand competitors, pricing, and market saturation.",
    details:
      "Planned competitor intelligence will help compare pricing, positioning, and competitive market conditions.",
    highlights: [
      "Competitor comparisons",
      "Market positioning",
      "Competitive signals",
    ],
    available: false,
  },
  {
    id: "reviews",
    icon: MessageCircle,
    title: "Review Analysis",
    description:
      "Discover customer sentiment and product improvement opportunities.",
    details:
      "Planned AI-powered review analysis will identify recurring complaints, positive trends, and customer preferences.",
    highlights: [
      "Customer sentiment",
      "Common complaints",
      "Product improvement opportunities",
    ],
    available: false,
  },
  {
    id: "profit",
    icon: Calculator,
    title: "Profit Simulation",
    description:
      "Estimate revenue, costs, margins, and profitability.",
    details:
      "Explore price changes and profitability scenarios using the existing What-If simulator.",
    highlights: [
      "Pricing scenarios",
      "Estimated operating costs",
      "Profitability comparisons",
    ],
    available: true,
  },
  {
    id: "recommendations",
    icon: Lightbulb,
    title: "AI Recommendations",
    description:
      "Find promising product ideas based on your goals.",
    details:
      "A planned recommendation system will help sellers discover products based on preferences and business goals.",
    highlights: [
      "Budget preferences",
      "Target profit margins",
      "Product discovery",
    ],
    available: false,
  },
];

const steps = [
  {
    number: "01",
    title: "Search",
    icon: Search,
    description:
      "Choose an existing product or explore a new product idea.",
    details:
      "Start by selecting a product or entering its characteristics. MarketLens supports separate workflows for product scoring and financial forecasting.",
    bullets: [
      "Explore product characteristics",
      "Search the forecasting catalogue",
      "Define a new product launch",
    ],
  },
  {
    number: "02",
    title: "Analyze",
    icon: BrainCircuit,
    description:
      "Choose the model that matches your research goal.",
    details:
      "Use Opportunity Analysis to evaluate product potential, or Sales Forecasting to estimate sales and financial performance.",
    bullets: [
      "Product Opportunity Score",
      "Existing product forecasting",
      "New product launch forecasting",
    ],
  },
  {
    number: "03",
    title: "Understand",
    icon: BarChart3,
    description:
      "Explore predictions, charts, and financial insights.",
    details:
      "Review the model's outputs, understand estimated uncertainty, and examine the factors behind your results.",
    bullets: [
      "Visualize forecast metrics",
      "Examine profitability estimates",
      "Review model limitations",
    ],
  },
  {
    number: "04",
    title: "Decide",
    icon: CheckCircle2,
    description:
      "Use insights to support informed launch decisions.",
    details:
      "Combine model predictions with your own business assumptions to evaluate whether a product deserves further research.",
    bullets: [
      "Understand potential risk",
      "Compare financial scenarios",
      "Plan your next steps",
    ],
  },
];

const aboutHighlights = [
  {
    icon: Target,
    title: "Built for Smarter Decisions",
    description:
      "Evaluate product opportunities using meaningful market data instead of relying on guesswork.",
  },
  {
    icon: BrainCircuit,
    title: "Powered by AI",
    description:
      "Bring together predictive modeling, forecasting, and customer insights in one research experience.",
  },
  {
    icon: ShieldCheck,
    title: "Understand the Risks",
    description:
      "Identify potential challenges before committing resources to a product launch.",
  },
];

// ========================================
// ILLUSTRATIVE DASHBOARD DATA
// ========================================

// These values are demonstration data only.
// No live API requests are made on the landing page.

const demoForecast = [
  { month: "Jan", revenue: 3200, profit: 650 },
  { month: "Feb", revenue: 4100, profit: 1050 },
  { month: "Mar", revenue: 3900, profit: 900 },
  { month: "Apr", revenue: 5300, profit: 1450 },
  { month: "May", revenue: 6100, profit: 1850 },
  { month: "Jun", revenue: 7200, profit: 2300 },
];

const demoOpportunity = [
  { factor: "Demand", score: 88 },
  { factor: "Pricing", score: 76 },
  { factor: "Potential", score: 92 },
  { factor: "Reviews", score: 81 },
  { factor: "Market", score: 84 },
];

const currencyFormatter = new Intl.NumberFormat(
  "en-US",
  {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }
);

// ========================================
// MOTION SETTINGS
// ========================================

const EASE = [0.22, 1, 0.36, 1];

const fadeUp = {
  hidden: {
    opacity: 0,
    y: 28,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.65,
      ease: EASE,
    },
  },
};

const stagger = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.1,
    },
  },
};

// ========================================
// REUSABLE SCROLL REVEAL
// ========================================

function Reveal({
  children,
  delay = 0,
  direction = "up",
  className = "",
}) {
  const reduceMotion = useReducedMotion();

  const offsets = {
    up: { x: 0, y: 35 },
    left: { x: -40, y: 0 },
    right: { x: 40, y: 0 },
  };

  return (
    <motion.div
      initial={
        reduceMotion
          ? false
          : {
              opacity: 0,
              ...offsets[direction],
            }
      }
      whileInView={{
        opacity: 1,
        x: 0,
        y: 0,
      }}
      viewport={{
        once: true,
        amount: 0.15,
      }}
      transition={{
        duration: reduceMotion ? 0 : 0.65,
        delay: reduceMotion ? 0 : delay,
        ease: EASE,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ========================================
// DASHBOARD METRIC
// ========================================

function PreviewMetric({
  label,
  value,
  color = "#193B66",
  icon: Icon,
}) {
  return (
    <div className="rounded-xl border border-[#E5EAF1] bg-white p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-[#61738B] sm:text-xs">
          {label}
        </span>

        {Icon && (
          <Icon
            size={15}
            style={{ color }}
          />
        )}
      </div>

      <p
        className="mt-3 break-words text-lg font-extrabold sm:text-2xl"
        style={{ color }}
      >
        {value}
      </p>
    </div>
  );
}

// ========================================
// INTERACTIVE DASHBOARD PREVIEW
// ========================================

function DashboardPreview() {
  const [activeTab, setActiveTab] =
    useState("forecast");

  const reduceMotion = useReducedMotion();

  const isForecast = activeTab === "forecast";

  return (
    <div className="relative mx-auto w-full max-w-[650px]">
      {/* BACKGROUND GLOW */}

      <div className="pointer-events-none absolute -inset-6 rounded-[40px] bg-[#D8E5F5]/60 blur-3xl" />

      {/* DASHBOARD */}

      <div className="relative overflow-hidden rounded-2xl border border-[#D7E0EB] bg-white shadow-[0_25px_80px_rgba(19,30,41,0.16)]">

        {/* WINDOW HEADER */}

        <div className="flex items-center justify-between gap-3 border-b border-[#E5EAF1] bg-[#F8FAFC] px-4 py-3 sm:px-5">
          <span className="text-xs font-bold text-[#25334A]">
            MarketLens Preview
          </span>

          <span className="rounded-full bg-[#FFF4D4] px-3 py-1 text-[10px] font-semibold text-[#8B6B1E]">
            Illustrative Demo
          </span>
        </div>

        {/* MAIN DASHBOARD */}

        <div className="grid grid-cols-[65px_1fr] sm:grid-cols-[125px_1fr]">

          {/* SIDEBAR */}

          <aside className="min-h-[335px] bg-[#131E29] px-2 py-5 text-white sm:px-3">

            <div className="mb-8 flex items-center gap-2 px-1">
              <span className="text-xl text-[#FFD45A]">
                ◈
              </span>

              <span className="hidden text-xs font-bold sm:inline">
                marketlens
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2 rounded-lg bg-[#193B66] px-2 py-3 sm:justify-start">
                <Search size={15} />

                <span className="hidden text-xs sm:inline">
                  Discover
                </span>
              </div>

              <div className="flex items-center justify-center gap-2 px-2 py-3 text-slate-300 sm:justify-start">
                <BarChart3 size={15} />

                <span className="hidden text-xs sm:inline">
                  Overview
                </span>
              </div>

              <div className="flex items-center justify-center gap-2 px-2 py-3 text-slate-300 sm:justify-start">
                <TrendingUp size={15} />

                <span className="hidden text-xs sm:inline">
                  Forecast
                </span>
              </div>
            </div>
          </aside>

          {/* DASHBOARD CONTENT */}

          <div className="min-w-0 space-y-4 p-3 sm:p-5">

            {/* ANALYSIS SELECTOR */}

            <div
              role="group"
              aria-label="Demo dashboard mode"
              className="grid grid-cols-2 gap-1 rounded-xl bg-[#EDF2F8] p-1"
            >
              <button
                type="button"
                onClick={() =>
                  setActiveTab("forecast")
                }
                aria-pressed={isForecast}
                className={`rounded-lg px-2 py-2 text-[10px] font-bold transition-all sm:text-xs ${
                  isForecast
                    ? "bg-white text-[#193B66] shadow-sm"
                    : "text-[#61738B] hover:text-[#193B66]"
                }`}
              >
                Sales Forecast
              </button>

              <button
                type="button"
                onClick={() =>
                  setActiveTab("opportunity")
                }
                aria-pressed={!isForecast}
                className={`rounded-lg px-2 py-2 text-[10px] font-bold transition-all sm:text-xs ${
                  !isForecast
                    ? "bg-white text-[#193B66] shadow-sm"
                    : "text-[#61738B] hover:text-[#193B66]"
                }`}
              >
                Opportunity
              </button>
            </div>

            {/* ANIMATED CONTENT */}

            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={
                  reduceMotion
                    ? false
                    : {
                        opacity: 0,
                        x: 20,
                      }
                }
                animate={{
                  opacity: 1,
                  x: 0,
                }}
                exit={
                  reduceMotion
                    ? undefined
                    : {
                        opacity: 0,
                        x: -20,
                      }
                }
                transition={{
                  duration: reduceMotion ? 0 : 0.25,
                }}
                className="space-y-4"
              >
                {/* SALES FORECAST DEMO */}

                {isForecast ? (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      <PreviewMetric
                        label="Revenue"
                        value="$42.8k"
                        icon={DollarSign}
                      />

                      <PreviewMetric
                        label="Net Profit"
                        value="$11.4k"
                        color="#13795B"
                        icon={Wallet}
                      />

                      <PreviewMetric
                        label="ROI"
                        value="36.2%"
                        color="#A77E1C"
                        icon={TrendingUp}
                      />
                    </div>

                    <div className="rounded-xl border border-[#E5EAF1] bg-white p-3 sm:p-4">
                      <div className="mb-4">
                        <h3 className="text-xs font-bold text-[#25334A]">
                          Sales Forecast
                        </h3>

                        <p className="mt-1 text-[10px] text-[#61738B]">
                          Example revenue and profit trends
                        </p>
                      </div>

                      <div className="h-[150px] w-full sm:h-[175px]">
                        <ResponsiveContainer
                          width="100%"
                          height="100%"
                        >
                          <AreaChart
                            data={demoForecast}
                            margin={{
                              top: 10,
                              right: 5,
                              left: -25,
                              bottom: 0,
                            }}
                          >
                            <defs>
                              <linearGradient
                                id="landingRevenueFill"
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                              >
                                <stop
                                  offset="0%"
                                  stopColor="#193B66"
                                  stopOpacity={0.2}
                                />
                                <stop
                                  offset="100%"
                                  stopColor="#193B66"
                                  stopOpacity={0}
                                />
                              </linearGradient>
                            </defs>

                            <CartesianGrid
                              strokeDasharray="3 3"
                              vertical={false}
                              stroke="#EDF1F6"
                            />

                            <XAxis
                              dataKey="month"
                              tick={{
                                fontSize: 10,
                                fill: "#61738B",
                              }}
                              axisLine={false}
                              tickLine={false}
                            />

                            <YAxis
                              tick={{
                                fontSize: 10,
                                fill: "#61738B",
                              }}
                              axisLine={false}
                              tickLine={false}
                              width={55}
                              tickFormatter={(value) =>
                                `$${value / 1000}k`
                              }
                            />

                            <Tooltip
                              formatter={(value) =>
                                currencyFormatter.format(value)
                              }
                            />

                            <Area
                              type="monotone"
                              dataKey="revenue"
                              name="Revenue"
                              stroke="#193B66"
                              strokeWidth={3}
                              fill="url(#landingRevenueFill)"
                              isAnimationActive={!reduceMotion}
                            />

                            <Area
                              type="monotone"
                              dataKey="profit"
                              name="Profit"
                              stroke="#D4A529"
                              strokeWidth={2}
                              fill="none"
                              isAnimationActive={!reduceMotion}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 rounded-lg bg-[#EAF8F1] px-3 py-2">
                      <CheckCircle2
                        size={15}
                        className="shrink-0 text-[#13795B]"
                      />

                      <span className="text-[10px] font-semibold text-[#13795B] sm:text-xs">
                        Example upward revenue trend
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      <PreviewMetric
                        label="Opportunity"
                        value="87/100"
                        icon={Target}
                      />

                      <PreviewMetric
                        label="Demand"
                        value="High"
                        color="#13795B"
                        icon={TrendingUp}
                      />

                      <PreviewMetric
                        label="Competition"
                        value="Medium"
                        color="#A77E1C"
                        icon={BarChart3}
                      />
                    </div>

                    <div className="rounded-xl border border-[#E5EAF1] bg-white p-3 sm:p-4">
                      <div className="mb-4">
                        <h3 className="text-xs font-bold text-[#25334A]">
                          Market Signals
                        </h3>

                        <p className="mt-1 text-[10px] text-[#61738B]">
                          Illustrative factor visualization
                        </p>
                      </div>

                      <div className="space-y-3">
                        {demoOpportunity.map(
                          (item, index) => (
                            <div
                              key={item.factor}
                              className="flex items-center gap-3"
                            >
                              <span className="w-16 shrink-0 text-[10px] text-[#61738B] sm:w-20">
                                {item.factor}
                              </span>

                              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#E8EEF5]">
                                <motion.div
                                  initial={{
                                    width: reduceMotion
                                      ? `${item.score}%`
                                      : 0,
                                  }}
                                  animate={{
                                    width: `${item.score}%`,
                                  }}
                                  transition={{
                                    duration: reduceMotion
                                      ? 0
                                      : 0.65,
                                    delay: reduceMotion
                                      ? 0
                                      : index * 0.09,
                                  }}
                                  className="h-full rounded-full bg-[#193B66]"
                                />
                              </div>

                              <span className="w-7 text-right text-[10px] font-bold text-[#25334A]">
                                {item.score}
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 rounded-lg bg-[#FFF6DB] px-3 py-2">
                      <Target
                        size={15}
                        className="shrink-0 text-[#A77E1C]"
                      />

                      <span className="text-[10px] font-semibold text-[#8B6B1E] sm:text-xs">
                        Example product opportunity
                      </span>
                    </div>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* DEMO DISCLAIMER */}

        <div className="border-t border-[#E5EAF1] bg-[#F8FAFC] px-4 py-2 text-center">
          <p className="text-[10px] text-[#61738B]">
            Illustrative demo data — not live predictions.
          </p>
        </div>
      </div>
    </div>
  );
}

// ========================================
// LANDING PAGE HEADER
// ========================================

function LandingHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className="relative z-30 bg-[#131E29] text-white">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-6 py-5 lg:px-20">

        <MarketLensLogo
          to="/"
          onClick={closeMenu}
        />

        {/* DESKTOP NAVIGATION */}

        <nav
          aria-label="Landing page navigation"
          className="hidden items-center gap-9 text-sm font-medium md:flex"
        >
          <a
            href="#features"
            className="transition-colors hover:text-[#FFD45A]"
          >
            Features
          </a>

          <a
            href="#how-it-works"
            className="transition-colors hover:text-[#FFD45A]"
          >
            How It Works
          </a>

          <a
            href="#about"
            className="transition-colors hover:text-[#FFD45A]"
          >
            About
          </a>
        </nav>

        <Link
          to="/discover"
          className="hidden items-center gap-2 rounded-xl bg-[#FFD45A] px-6 py-3 text-sm font-bold text-[#131E29] transition-colors hover:bg-[#F6C94D] md:inline-flex"
        >
          Get Started
          <ArrowRight size={17} />
        </Link>

        {/* MOBILE MENU */}

        <button
          type="button"
          aria-label={
            menuOpen ? "Close menu" : "Open menu"
          }
          aria-expanded={menuOpen}
          onClick={() =>
            setMenuOpen((previous) => !previous)
          }
          className="rounded-lg p-2 transition-colors hover:bg-white/10 md:hidden"
        >
          {menuOpen ? (
            <X size={24} />
          ) : (
            <Menu size={24} />
          )}
        </button>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.nav
            initial={{
              opacity: 0,
              height: 0,
            }}
            animate={{
              opacity: 1,
              height: "auto",
            }}
            exit={{
              opacity: 0,
              height: 0,
            }}
            transition={{ duration: 0.2 }}
            aria-label="Mobile navigation"
            className="overflow-hidden border-t border-white/10 md:hidden"
          >
            <div className="flex flex-col gap-5 px-6 pb-6 pt-5 text-sm">
              <a
                href="#features"
                onClick={closeMenu}
              >
                Features
              </a>

              <a
                href="#how-it-works"
                onClick={closeMenu}
              >
                How It Works
              </a>

              <a
                href="#about"
                onClick={closeMenu}
              >
                About
              </a>

              <Link
                to="/discover"
                onClick={closeMenu}
                className="w-fit rounded-lg bg-[#FFD45A] px-5 py-3 font-bold text-[#131E29]"
              >
                Get Started
              </Link>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}

// ========================================
// HERO SECTION
// ========================================

function HeroSection() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#F8FAFC] to-[#EAF1F9]">
      <div className="pointer-events-none absolute -bottom-64 -left-32 h-96 w-[60rem] rounded-[50%] bg-white/60 blur-3xl" />

      <div className="relative mx-auto grid max-w-[1440px] items-center gap-14 px-6 py-20 lg:grid-cols-2 lg:gap-12 lg:px-20 lg:py-28">

        {/* HERO TEXT */}

        <motion.div
          initial={reduceMotion ? false : "hidden"}
          animate="visible"
          variants={stagger}
          className="max-w-[590px]"
        >
          <motion.span
            variants={fadeUp}
            className="inline-flex rounded-full bg-[#DFEAF8] px-5 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#193B66]"
          >
            AI-Powered Product Intelligence
          </motion.span>

          <motion.h1
            variants={fadeUp}
            className="mt-8 text-[clamp(2.8rem,4.5vw,4.4rem)] font-extrabold leading-[1.09] tracking-[-0.04em] text-[#131E29]"
          >
            Discover Your Next{" "}
            <span className="relative inline-block">
              Winning Product

              <span
                aria-hidden="true"
                className="absolute -bottom-2 left-0 h-1.5 w-32 rounded-full bg-[#FFD45A]"
              />
            </span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mt-9 max-w-[560px] text-lg leading-8 text-[#475569]"
          >
            Make smarter Amazon selling decisions with
            AI-powered insights on demand, competition,
            profitability, and more.
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="mt-9 flex flex-wrap gap-4"
          >
            <Link
              to="/discover"
              className="inline-flex items-center justify-center gap-3 rounded-xl bg-[#FFD45A] px-7 py-4 text-base font-bold text-[#131E29] shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[#F6C94D] motion-reduce:transform-none"
            >
              Start Analyzing
              <ArrowRight size={19} />
            </Link>

            <a
              href="#features"
              className="inline-flex items-center justify-center rounded-xl border border-[#193B66] bg-white/50 px-7 py-4 text-base font-semibold text-[#193B66] transition-colors hover:bg-white"
            >
              Explore Features
            </a>
          </motion.div>
        </motion.div>

        {/* INTERACTIVE DASHBOARD */}

        <motion.div
          initial={
            reduceMotion
              ? false
              : {
                  opacity: 0,
                  y: 35,
                  scale: 0.97,
                }
          }
          animate={{
            opacity: 1,
            y: 0,
            scale: 1,
          }}
          transition={{
            duration: 0.8,
            delay: reduceMotion ? 0 : 0.2,
            ease: EASE,
          }}
        >
          <DashboardPreview />
        </motion.div>
      </div>
    </section>
  );
}

// ========================================
// EXPANDABLE FEATURE CARD
// ========================================

function FeatureCard({
  feature,
  expanded,
  onToggle,
}) {
  const Icon = feature.icon;
  const reduceMotion = useReducedMotion();

  return (
    <motion.article
      layout={!reduceMotion}
      whileHover={
        reduceMotion
          ? undefined
          : { y: -5 }
      }
      transition={{
        duration: 0.25,
      }}
      className={`self-start overflow-hidden rounded-2xl border bg-white shadow-sm transition-colors ${
        expanded
          ? "border-[#D4A529] shadow-lg"
          : "border-[#E2EAF3] hover:border-[#B8C8DA]"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={`feature-${feature.id}`}
        className="flex w-full flex-col items-center p-6 text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[#193B66]"
      >
        <div
          className={`mb-5 flex h-16 w-16 items-center justify-center rounded-2xl transition-colors ${
            expanded
              ? "bg-[#FFF3CC] text-[#A77E1C]"
              : "bg-[#EAF1F9] text-[#193B66]"
          }`}
        >
          <Icon
            size={29}
            strokeWidth={1.8}
          />
        </div>

        <h3 className="text-sm font-bold text-[#131E29]">
          {feature.title}
        </h3>

        <p className="mt-3 text-sm leading-6 text-[#61738B]">
          {feature.description}
        </p>

        <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#193B66]">
          {expanded ? "Show less" : "Learn more"}

          <ChevronDown
            size={15}
            className={`transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
          />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id={`feature-${feature.id}`}
            initial={
              reduceMotion
                ? false
                : {
                    height: 0,
                    opacity: 0,
                  }
            }
            animate={{
              height: "auto",
              opacity: 1,
            }}
            exit={{
              height: 0,
              opacity: 0,
            }}
            transition={{
              duration: reduceMotion ? 0 : 0.3,
              ease: "easeInOut",
            }}
            className="overflow-hidden"
          >
            <div className="border-t border-[#E7ECF3] px-5 pb-6 pt-4 text-left">
              <p className="text-xs leading-6 text-[#61738B]">
                {feature.details}
              </p>

              <div className="mt-4 space-y-3">
                {feature.highlights.map((item) => (
                  <div
                    key={item}
                    className="flex items-start gap-2"
                  >
                    <CheckCircle2
                      size={16}
                      className="mt-0.5 shrink-0 text-[#13795B]"
                    />

                    <span className="text-xs text-[#475569]">
                      {item}
                    </span>
                  </div>
                ))}
              </div>

              <p className="mt-5 text-[11px] font-bold uppercase tracking-wide text-[#A77E1C]">
                {feature.available
                  ? "Available in MarketLens"
                  : "Planned feature"}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

// ========================================
// FEATURES SECTION
// ========================================

function FeaturesSection() {
  const [expandedFeature, setExpandedFeature] =
    useState(null);

  function toggleFeature(id) {
    setExpandedFeature((previous) =>
      previous === id ? null : id
    );
  }

  return (
    <section
      id="features"
      className="scroll-mt-8 bg-white px-6 py-24 lg:px-20"
    >
      <div className="mx-auto max-w-[1320px]">
        <Reveal className="mb-14 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#193B66]">
            Powerful Features
          </p>

          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[#131E29] sm:text-4xl">
            Everything You Need to Succeed
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-base text-[#61738B]">
            Explore MarketLens capabilities and planned
            product research tools.
          </p>

          <p className="mt-3 text-xs text-[#94A3B8]">
            Select a feature card to learn more.
          </p>
        </Reveal>

        <div className="grid items-start gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <Reveal
              key={feature.id}
              delay={(index % 3) * 0.09}
            >
              <FeatureCard
                feature={feature}
                expanded={
                  expandedFeature === feature.id
                }
                onToggle={() =>
                  toggleFeature(feature.id)
                }
              />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ========================================
// INTERACTIVE HOW IT WORKS SECTION
// ========================================

function HowItWorksSection() {
  const [activeStep, setActiveStep] =
    useState(0);

  const reduceMotion = useReducedMotion();

  const selected = steps[activeStep];
  const SelectedIcon = selected.icon;

  function goNext() {
    setActiveStep((previous) =>
      (previous + 1) % steps.length
    );
  }

  function goPrevious() {
    setActiveStep((previous) =>
      Math.max(previous - 1, 0)
    );
  }

  return (
    <section
      id="how-it-works"
      className="scroll-mt-8 bg-[#F8FAFC] px-6 py-24 lg:px-20"
    >
      <div className="mx-auto max-w-[1260px]">
        <Reveal className="mb-12 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#193B66]">
            Simple Process
          </p>

          <h2 className="mt-3 text-3xl font-extrabold text-[#131E29] sm:text-4xl">
            How It Works
          </h2>

          <p className="mt-3 text-[#61738B]">
            From product idea to informed decision
            in four steps.
          </p>
        </Reveal>

        {/* CLICKABLE STEPS */}

        <Reveal>
          <div
            role="group"
            aria-label="MarketLens workflow steps"
            className="grid grid-cols-2 gap-3 md:grid-cols-4"
          >
            {steps.map((step, index) => {
              const isActive =
                activeStep === index;

              const StepIcon = step.icon;

              return (
                <button
                  key={step.number}
                  type="button"
                  onClick={() =>
                    setActiveStep(index)
                  }
                  aria-pressed={isActive}
                  className={`rounded-2xl border p-4 text-left transition-all sm:p-5 ${
                    isActive
                      ? "border-[#D4A529] bg-white shadow-lg ring-2 ring-[#FFD45A]/20"
                      : "border-[#E2EAF3] bg-white hover:border-[#B8C8DA] hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold ${
                        isActive
                          ? "bg-[#FFD45A] text-[#131E29]"
                          : "bg-[#EAF1F9] text-[#193B66]"
                      }`}
                    >
                      {step.number}
                    </span>

                    <StepIcon
                      size={20}
                      className={
                        isActive
                          ? "text-[#A77E1C]"
                          : "text-[#8FA4BA]"
                      }
                    />
                  </div>

                  <h3 className="mt-5 text-base font-bold text-[#131E29]">
                    {step.title}
                  </h3>

                  <p className="mt-2 text-xs leading-5 text-[#61738B]">
                    {step.description}
                  </p>
                </button>
              );
            })}
          </div>
        </Reveal>

        {/* ANIMATED STEP DETAILS */}

        <div className="mt-7 overflow-hidden rounded-3xl border border-[#D7E0EB] bg-white shadow-sm">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStep}
              initial={
                reduceMotion
                  ? false
                  : {
                      opacity: 0,
                      x: 35,
                    }
              }
              animate={{
                opacity: 1,
                x: 0,
              }}
              exit={
                reduceMotion
                  ? undefined
                  : {
                      opacity: 0,
                      x: -35,
                    }
              }
              transition={{
                duration: reduceMotion ? 0 : 0.3,
                ease: EASE,
              }}
              className="grid gap-8 p-6 sm:p-8 md:grid-cols-[1fr_1.1fr] md:p-10"
            >
              {/* STEP INFORMATION */}

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#A77E1C]">
                  Step {selected.number} of 04
                </p>

                <h3 className="mt-3 text-3xl font-extrabold text-[#131E29]">
                  {selected.title}
                </h3>

                <p className="mt-5 text-sm leading-7 text-[#61738B]">
                  {selected.details}
                </p>

                <div className="mt-7 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={goPrevious}
                    disabled={activeStep === 0}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#D7E0EB] bg-white px-5 py-3 text-sm font-semibold text-[#193B66] hover:bg-[#F5F8FC] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ArrowLeft size={16} />
                    Previous
                  </button>

                  <button
                    type="button"
                    onClick={goNext}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#193B66] px-5 py-3 text-sm font-semibold text-white hover:bg-[#275788]"
                  >
                    {activeStep === 3
                      ? "Start over"
                      : "Next step"}

                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>

              {/* STEP VISUAL */}

              <div className="rounded-2xl bg-[#F0F5FB] p-5 sm:p-7">
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#193B66] text-[#FFD45A]">
                    <SelectedIcon size={25} />
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-[#61738B]">
                      MarketLens Workflow
                    </p>

                    <p className="text-base font-bold text-[#25334A]">
                      {selected.title}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {selected.bullets.map(
                    (bullet, index) => (
                      <motion.div
                        key={bullet}
                        initial={
                          reduceMotion
                            ? false
                            : {
                                opacity: 0,
                                y: 10,
                              }
                        }
                        animate={{
                          opacity: 1,
                          y: 0,
                        }}
                        transition={{
                          duration: reduceMotion
                            ? 0
                            : 0.3,
                          delay: reduceMotion
                            ? 0
                            : index * 0.08,
                        }}
                        className="flex items-center gap-3 rounded-xl border border-[#E2EAF3] bg-white px-4 py-3"
                      >
                        <CheckCircle2
                          size={18}
                          className="shrink-0 text-[#13795B]"
                        />

                        <span className="text-sm font-medium text-[#475569]">
                          {bullet}
                        </span>
                      </motion.div>
                    )
                  )}
                </div>

                {/* STEP PROGRESS */}

                <div className="mt-7 flex gap-2">
                  {steps.map((step, index) => (
                    <div
                      key={step.number}
                      className={`h-1.5 flex-1 rounded-full transition-colors ${
                        index <= activeStep
                          ? "bg-[#D4A529]"
                          : "bg-[#D7E0EB]"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

// ========================================
// ABOUT MARKETLENS SECTION
// ========================================

function AboutSection() {
  return (
    <section
      id="about"
      aria-labelledby="about-heading"
      className="scroll-mt-8 overflow-hidden bg-white px-6 py-24 lg:px-20"
    >
      <div className="mx-auto max-w-[1260px]">

        {/* SECTION INTRODUCTION */}

        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <Reveal direction="left">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#193B66]">
                About MarketLens
              </p>

              <h2
                id="about-heading"
                className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-[#131E29] sm:text-4xl lg:text-5xl"
              >
                Turning Market Data Into{" "}
                <span className="text-[#193B66]">
                  Smarter Decisions.
                </span>
              </h2>

              <p className="mt-7 text-base leading-8 text-[#61738B]">
                Launching a successful product starts with
                understanding the market. But researching demand,
                competition, pricing, and customer feedback can
                be complicated and time-consuming.
              </p>

              <p className="mt-5 text-base leading-8 text-[#61738B]">
                MarketLens brings these insights together in
                one AI-powered product intelligence platform,
                helping Amazon entrepreneurs evaluate
                opportunities, understand potential risks,
                and make more informed launch decisions.
              </p>

              <Link
                to="/discover"
                className="mt-8 inline-flex items-center gap-2 font-bold text-[#193B66] transition-colors hover:text-[#275788]"
              >
                Explore MarketLens
                <ArrowRight size={18} />
              </Link>
            </div>
          </Reveal>

          {/* MISSION PANEL */}

          <Reveal direction="right">
            <div className="relative">
              <div className="absolute -inset-4 rounded-[32px] bg-[#EAF1F9]" />

              <div className="relative overflow-hidden rounded-3xl border border-[#D7E0EB] bg-[#F8FAFC] p-8 shadow-sm sm:p-10">
                <div className="mb-8 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#193B66] text-[#FFD45A]">
                  <Target size={29} />
                </div>

                <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#61738B]">
                  Our Mission
                </p>

                <h3 className="mt-4 text-2xl font-bold leading-snug text-[#131E29] sm:text-3xl">
                  Make Product Research More Accessible,
                  Intelligent, and Actionable.
                </h3>

                <div className="mt-8 h-1 w-20 rounded-full bg-[#FFD45A]" />

                <p className="mt-7 text-sm leading-7 text-[#61738B]">
                  We believe product decisions should be
                  supported by clear data, meaningful
                  predictions, and understandable insights.
                </p>
              </div>
            </div>
          </Reveal>
        </div>

        {/* ABOUT HIGHLIGHTS */}

        <div className="mt-20 grid gap-8 md:grid-cols-3">
          {aboutHighlights.map((item, index) => {
            const Icon = item.icon;

            return (
              <Reveal
                key={item.title}
                delay={index * 0.1}
              >
                <div className="border-t border-[#D7E0EB] pt-7">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#EAF1F9] text-[#193B66]">
                    <Icon
                      size={24}
                      strokeWidth={1.8}
                    />
                  </div>

                  <h3 className="text-lg font-bold text-[#131E29]">
                    {item.title}
                  </h3>

                  <p className="mt-3 text-sm leading-7 text-[#61738B]">
                    {item.description}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ========================================
// FINAL CALL TO ACTION
// ========================================

function FinalCTA() {
  return (
    <section
      aria-labelledby="final-cta-heading"
      className="bg-[#F8FAFC] px-6 py-20 lg:px-20"
    >
      <Reveal>
        <div className="mx-auto flex max-w-[1280px] flex-col items-start justify-between gap-8 rounded-3xl bg-[#193B66] px-8 py-12 text-white sm:px-12 lg:flex-row lg:items-center">
          <div>
            <h2
              id="final-cta-heading"
              className="text-2xl font-extrabold tracking-tight sm:text-3xl"
            >
              Stop Guessing. Start Selling Smarter.
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#DCE8F5]">
              Explore market insights, evaluate product
              opportunities, and make better decisions
              with MarketLens.
            </p>
          </div>

          <Link
            to="/discover"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#FFD45A] px-7 py-4 font-bold text-[#131E29] transition-all hover:-translate-y-0.5 hover:bg-[#F6C94D] motion-reduce:transform-none"
          >
            Get Started
            <ArrowRight size={19} />
          </Link>
        </div>
      </Reveal>
    </section>
  );
}

// ========================================
// MAIN LANDING PAGE
// ========================================

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white text-[#131E29]">
      <LandingHeader />

      <HeroSection />

      <FeaturesSection />

      <HowItWorksSection />

      <AboutSection />

      <FinalCTA />
    </main>
  );
}
