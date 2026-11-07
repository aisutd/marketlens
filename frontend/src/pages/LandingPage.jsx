
import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";

import {
  ArrowRight,
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
} from "lucide-react";

import MarketLensLogo from "../components/MarketLensLogo";

// ========================================
// LANDING PAGE DATA
// ========================================

const features = [
  {
    icon: BarChart3,
    title: "Opportunity Scoring",
    description:
      "Evaluate product potential with intelligent market scoring.",
  },
  {
    icon: TrendingUp,
    title: "Sales Forecasting",
    description:
      "Predict demand and explore future sales trends.",
  },
  {
    icon: UsersRound,
    title: "Competitor Analysis",
    description:
      "Understand competitors, pricing, and market saturation.",
  },
  {
    icon: MessageCircle,
    title: "Review Analysis",
    description:
      "Discover customer sentiment and product improvement opportunities.",
  },
  {
    icon: Calculator,
    title: "Profit Simulation",
    description:
      "Estimate revenue, costs, margins, and profitability.",
  },
  {
    icon: Lightbulb,
    title: "AI Recommendations",
    description:
      "Find promising product ideas based on your goals.",
  },
];

const steps = [
  {
    number: "01",
    title: "Search",
    description:
      "Choose an existing product or explore a new product idea.",
  },
  {
    number: "02",
    title: "Analyze",
    description:
      "Explore demand, competition, pricing, and market signals.",
  },
  {
    number: "03",
    title: "Understand",
    description:
      "Review opportunity scores, forecasts, and actionable insights.",
  },
  {
    number: "04",
    title: "Decide",
    description:
      "Use data-driven insights to make informed launch decisions.",
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
// ANIMATION SETTINGS
// ========================================

const fadeUp = {
  hidden: {
    opacity: 0,
    y: 25,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: "easeOut",
    },
  },
};

// ========================================
// DASHBOARD PREVIEW
// ========================================

function DashboardPreview() {
  // Illustrative demo data only.
  // This component does not request predictions.

  const chartValues = [
    52, 65, 61, 76, 73, 90, 86, 101, 112,
  ];

  const chartPoints = chartValues
    .map((value, index) => {
      return `${20 + index * 48},${150 - value}`;
    })
    .join(" ");

  return (
    <div className="relative mx-auto w-full max-w-[650px]">
      {/* Background glow */}
      <div className="pointer-events-none absolute -inset-6 rounded-[40px] bg-[#D8E5F5]/60 blur-3xl" />

      {/* Dashboard container */}
      <div className="relative overflow-hidden rounded-2xl border border-[#D7E0EB] bg-white shadow-[0_25px_80px_rgba(19,30,41,0.16)]">

        {/* Window header */}
        <div className="flex items-center justify-between border-b border-[#E5EAF1] bg-[#F8FAFC] px-5 py-3">
          <span className="text-xs font-bold text-[#25334A]">
            Product Overview
          </span>

          <span className="rounded-full bg-[#FFF4D4] px-3 py-1 text-[10px] font-semibold text-[#8B6B1E]">
            Demo Preview
          </span>
        </div>

        {/* Dashboard layout */}
        <div className="grid grid-cols-[95px_1fr] sm:grid-cols-[145px_1fr]">

          {/* Sidebar */}
          <aside className="min-h-[290px] bg-[#131E29] px-2 py-5 text-white sm:px-3">
            <div className="mb-7 flex items-center gap-2 px-1">
              <span className="text-xl text-[#FFD45A]">
                ◈
              </span>

              <span className="text-[10px] font-bold sm:text-xs">
                marketlens
              </span>
            </div>

            <div className="space-y-2 text-[10px] sm:text-xs">
              <div className="flex items-center gap-2 rounded-lg bg-[#193B66] px-2 py-2.5">
                <Search size={14} />
                <span>Discover</span>
              </div>

              <div className="flex items-center gap-2 px-2 py-2.5 text-slate-300">
                <BarChart3 size={14} />
                <span>Overview</span>
              </div>

              <div className="flex items-center gap-2 px-2 py-2.5 text-slate-300">
                <TrendingUp size={14} />
                <span>Forecasting</span>
              </div>
            </div>
          </aside>

          {/* Dashboard content */}
          <div className="space-y-4 p-3 sm:p-5">

            {/* Metric cards */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">

              {/* Opportunity Score */}
              <div className="rounded-xl border border-[#E5EAF1] bg-white p-2 sm:p-3">
                <p className="text-[9px] text-[#61738B] sm:text-[11px]">
                  Opportunity
                </p>

                <p className="mt-2 text-lg font-bold text-[#193B66] sm:text-2xl">
                  87
                  <span className="text-xs">
                    /100
                  </span>
                </p>
              </div>

              {/* Demand */}
              <div className="rounded-xl border border-[#E5EAF1] bg-white p-2 sm:p-3">
                <p className="text-[9px] text-[#61738B] sm:text-[11px]">
                  Demand
                </p>

                <p className="mt-2 text-base font-bold text-[#13795B] sm:text-xl">
                  High
                </p>
              </div>

              {/* Competition */}
              <div className="rounded-xl border border-[#E5EAF1] bg-white p-2 sm:p-3">
                <p className="text-[9px] text-[#61738B] sm:text-[11px]">
                  Competition
                </p>

                <p className="mt-2 text-sm font-bold text-[#B66A29] sm:text-xl">
                  Medium
                </p>
              </div>
            </div>

            {/* Sales forecast chart */}
            <div className="rounded-xl border border-[#E5EAF1] bg-white p-3 sm:p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-[#25334A]">
                  Sales Forecast
                </h3>

                <span className="text-[10px] text-[#61738B]">
                  Illustrative trend
                </span>
              </div>

              <svg
                viewBox="0 0 440 140"
                role="img"
                aria-label="Illustrative rising sales forecast"
                className="h-28 w-full sm:h-40"
              >
                <defs>
                  <linearGradient
                    id="landing-chart-fill"
                    x1="0"
                    x2="0"
                    y1="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="#193B66"
                      stopOpacity="0.18"
                    />

                    <stop
                      offset="100%"
                      stopColor="#193B66"
                      stopOpacity="0"
                    />
                  </linearGradient>
                </defs>

                {[30, 70, 110].map((y) => (
                  <line
                    key={y}
                    x1="12"
                    x2="430"
                    y1={y}
                    y2={y}
                    stroke="#E8EEF4"
                  />
                ))}

                <polygon
                  points={`20,140 ${chartPoints} 404,140`}
                  fill="url(#landing-chart-fill)"
                />

                <polyline
                  points={chartPoints}
                  fill="none"
                  stroke="#193B66"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {chartValues.map((value, index) => (
                  <circle
                    key={index}
                    cx={20 + index * 48}
                    cy={150 - value}
                    r="3.5"
                    fill="#FFD45A"
                    stroke="#193B66"
                    strokeWidth="1.5"
                  />
                ))}
              </svg>
            </div>

            {/* Bottom insight */}
            <div className="flex items-center gap-2 rounded-lg bg-[#EAF8F1] px-3 py-2">
              <CheckCircle2
                size={15}
                className="shrink-0 text-[#13795B]"
              />

              <span className="text-[10px] font-semibold text-[#13795B] sm:text-xs">
                Positive market opportunity
              </span>
            </div>
          </div>
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

        {/* Shared MarketLens logo */}
        <MarketLensLogo
          to="/"
          onClick={closeMenu}
        />

        {/* Desktop navigation */}
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

        {/* Desktop CTA */}
        <Link
          to="/discover"
          className="hidden items-center gap-2 rounded-xl bg-[#FFD45A] px-6 py-3 text-sm font-bold text-[#131E29] transition-colors hover:bg-[#F6C94D] md:inline-flex"
        >
          Get Started
          <ArrowRight size={17} />
        </Link>

        {/* Mobile menu button */}
        <button
          type="button"
          aria-label={
            menuOpen ? "Close menu" : "Open menu"
          }
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
          className="rounded-lg p-2 transition-colors hover:bg-white/10 md:hidden"
        >
          {menuOpen ? (
            <X size={24} />
          ) : (
            <Menu size={24} />
          )}
        </button>
      </div>

      {/* Mobile navigation */}
      {menuOpen && (
        <nav
          aria-label="Mobile navigation"
          className="flex flex-col gap-5 border-t border-white/10 px-6 pb-6 pt-5 text-sm md:hidden"
        >
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
        </nav>
      )}
    </header>
  );
}

// ========================================
// HERO SECTION
// ========================================

function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#F8FAFC] to-[#EAF1F9]">

      {/* Background decoration */}
      <div className="pointer-events-none absolute -bottom-64 -left-32 h-96 w-[60rem] rounded-[50%] bg-white/60 blur-3xl" />

      <div className="relative mx-auto grid max-w-[1440px] items-center gap-14 px-6 py-20 lg:grid-cols-2 lg:gap-12 lg:px-20 lg:py-28">

        {/* Hero text */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="max-w-[590px]"
        >
          <span className="inline-flex rounded-full bg-[#DFEAF8] px-5 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#193B66]">
            AI-Powered Product Intelligence
          </span>

          <h1 className="mt-8 text-[clamp(2.8rem,4.5vw,4.4rem)] font-extrabold leading-[1.09] tracking-[-0.04em] text-[#131E29]">
            Discover Your Next{" "}

            <span className="relative inline-block">
              Winning Product

              <span
                aria-hidden="true"
                className="absolute -bottom-2 left-0 h-1.5 w-32 rounded-full bg-[#FFD45A]"
              />
            </span>
          </h1>

          <p className="mt-9 max-w-[560px] text-lg leading-8 text-[#475569]">
            Make smarter Amazon selling decisions with
            AI-powered insights on demand, competition,
            profitability, and more.
          </p>

          <div className="mt-9 flex flex-wrap gap-4">
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
          </div>
        </motion.div>

        {/* Dashboard */}
        <motion.div
          initial={{
            opacity: 0,
            y: 30,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.7,
            delay: 0.2,
          }}
        >
          <DashboardPreview />
        </motion.div>
      </div>
    </section>
  );
}

// ========================================
// FEATURES SECTION
// ========================================

function FeaturesSection() {
  return (
    <section
      id="features"
      className="scroll-mt-8 bg-white px-6 py-24 lg:px-20"
    >
      <div className="mx-auto max-w-[1320px]">
        <div className="mb-16 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#193B66]">
            Powerful Features
          </p>

          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[#131E29] sm:text-4xl">
            Everything You Need to Succeed
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-base text-[#61738B]">
            A complete platform for Amazon product research
            and launch planning.
          </p>
        </div>

        <div className="grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {features.map((feature) => {
            const Icon = feature.icon;

            return (
              <div
                key={feature.title}
                className="text-center"
              >
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EAF1F9] text-[#193B66]">
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
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ========================================
// HOW IT WORKS SECTION
// ========================================

function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-8 bg-[#F8FAFC] px-6 py-24 lg:px-20"
    >
      <div className="mx-auto max-w-[1260px]">

        <div className="mb-12 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#193B66]">
            Simple Process
          </p>

          <h2 className="mt-3 text-3xl font-extrabold text-[#131E29]">
            How It Works
          </h2>

          <p className="mt-3 text-[#61738B]">
            From product idea to informed decision in four steps.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-4">
          {steps.map((step) => (
            <div
              key={step.number}
              className="rounded-2xl border border-[#E2EAF3] bg-white p-6"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#FFD45A] text-sm font-bold text-[#131E29]">
                {step.number}
              </span>

              <h3 className="mt-5 text-lg font-bold text-[#131E29]">
                {step.title}
              </h3>

              <p className="mt-2 text-sm leading-6 text-[#61738B]">
                {step.description}
              </p>
            </div>
          ))}
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
      className="scroll-mt-8 bg-white px-6 py-24 lg:px-20"
    >
      <div className="mx-auto max-w-[1260px]">

        {/* Section introduction */}
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">

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

          {/* Mission visual */}
          <div className="relative">
            <div className="absolute -inset-4 rounded-[32px] bg-[#EAF1F9]"/>

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
        </div>

        {/* About highlights */}
        <div className="mt-20 grid gap-8 md:grid-cols-3">
          {aboutHighlights.map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.title}
                className="border-t border-[#D7E0EB] pt-7"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#EAF1F9] text-[#193B66]">
                  <Icon size={24} strokeWidth={1.8} />
                </div>

                <h3 className="text-lg font-bold text-[#131E29]">
                  {item.title}
                </h3>

                <p className="mt-3 text-sm leading-7 text-[#61738B]">
                  {item.description}
                </p>
              </div>
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
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#FFD45A] px-7 py-4 font-bold text-[#131E29] transition-colors hover:bg-[#F6C94D]"
        >
          Get Started
          <ArrowRight size={19} />
        </Link>

      </div>
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
