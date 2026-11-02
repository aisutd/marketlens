
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  const menuItems = [
    { label: "Discover", path: "/discover" },
    { label: "Overview", path: "/overview" },
    { label: "Score Explanations", path: "/score-details" },
    {
      label: "Launch Feasibility",
      path: "/launch-feasibility",
    },
  ];

  return (
    <header className="bg-[#131E29] text-white">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-6 py-5 lg:px-24">
        <Link
          to="/discover"
          className="flex items-center gap-3"
          onClick={() => setMenuOpen(false)}
        >
          <span className="rounded-lg bg-[#FFD45A] px-2 py-1 text-xl text-[#131E29]">
            ◈
          </span>

          <span className="text-2xl font-bold">
            marketlens
          </span>

          <span className="hidden border-l border-white/20 pl-3 text-sm text-slate-400 sm:block">
            Product intelligence
          </span>
        </Link>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="marketlens-menu"
            className="rounded-lg bg-[#F1F5FA] px-6 py-2 text-sm font-medium text-[#263549] hover:bg-white"
          >
            Menu ☰ ▾
          </button>

          {menuOpen && (
            <nav
              id="marketlens-menu"
              aria-label="Main navigation"
              className="absolute right-0 top-12 z-10 w-56 rounded-lg border border-slate-200 bg-white p-2 text-sm text-slate-800 shadow-lg"
            >
              {menuItems.map((item) => {
                const active = location.pathname === item.path;

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMenuOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`block rounded-md px-4 py-3 transition ${
                      active
                        ? "bg-[#FFFAE9] font-semibold text-[#0F172A]"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>
      </div>
    </header>
  );
}
