
import { Link } from "react-router-dom";

export default function MarketLensLogo({
  to = "/",
  tagline = false,
  onClick,
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      aria-label="MarketLens home"
      className="inline-flex items-center gap-3"
    >
      {/* Existing MarketLens symbol */}
      <span
        aria-hidden="true"
        className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#FFD45A] text-2xl font-semibold text-[#131E29]"
      >
        ◈
      </span>

      {/* Existing wordmark */}
      <span className="text-2xl font-bold tracking-tight text-white">
        marketlens
      </span>

      {/* Optional dashboard tagline */}
      {tagline && (
        <span className="hidden border-l border-white/20 pl-3 text-sm text-slate-400 sm:block">
          Product intelligence
        </span>
      )}
    </Link>
  );
}
