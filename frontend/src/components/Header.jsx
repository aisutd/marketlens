
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import MarketLensLogo from "./MarketLensLogo";

export default function Header({
  hasOpportunityResult = false,
  hasSalesForecast = false,
  hasLaunchForecast = false,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState("");

  const menuContainerRef = useRef(null);
  const toggleButtonRef = useRef(null);

  const location = useLocation();

  // Close the menu on Escape (returning focus to the
  // toggle) or when the user clicks/taps outside it.
  useEffect(() => {
    if (!menuOpen) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setNotice("");
        toggleButtonRef.current?.focus();
      }
    }

    function handlePointerDown(event) {
      if (
        menuContainerRef.current &&
        !menuContainerRef.current.contains(event.target)
      ) {
        setMenuOpen(false);
        setNotice("");
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [menuOpen]);

  const isDiscover = location.pathname === "/discover";

  // The opportunity "family" includes its detail pages.
  const isOpportunity = [
    "/product-overview",
    "/score-details",
    "/launch-feasibility",
  ].includes(location.pathname);

  const isSalesForecast =
    location.pathname === "/sales-forecast-overview";

  const isLaunchForecast =
    location.pathname === "/launch-forecast";

  function menuLinkStyle(active) {
    return `${menuItemStyle} ${
      active
        ? "bg-[#FFFAE9] font-semibold text-[#0F172A]"
        : "text-[#475569] hover:bg-[#F3F6FA]"
    }`;
  }

  // Placeholder actions until these features
  // are implemented.
  function handlePlaceholder(feature) {
    setNotice(`${feature} is coming soon.`);
  }

  function toggleMenu() {
    setMenuOpen((previous) => !previous);
    setNotice("");
  }

  function closeMenu() {
    setMenuOpen(false);
    setNotice("");
  }

  const menuItemStyle =
    "flex w-full items-center gap-3 rounded-lg px-4 py-3 " +
    "text-left text-sm font-medium transition-colors";

  return (
    <header className="relative z-30 bg-[#131E29] text-white">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-6 py-5 lg:px-24">

        {/* MARKETLENS BRAND */}
        <MarketLensLogo
          to="/"
          tagline
          onClick={closeMenu}
        />

        {/* NAVIGATION MENU */}
        <div className="relative" ref={menuContainerRef}>
          <button
            ref={toggleButtonRef}
            type="button"
            onClick={toggleMenu}
            aria-expanded={menuOpen}
            aria-controls="marketlens-menu"
            aria-label="Toggle navigation menu"
            className="flex items-center gap-3 rounded-lg bg-[#F1F5FA] px-5 py-3 text-sm font-semibold text-[#263549] transition-colors hover:bg-white"
          >
            Menu

            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 7h16" />
              <path d="M4 12h16" />
              <path d="M4 17h16" />
            </svg>

            <span
              aria-hidden="true"
              className={`text-xs transition-transform ${
                menuOpen ? "rotate-180" : ""
              }`}
            >
              ▾
            </span>
          </button>

          {menuOpen && (
            <nav
              id="marketlens-menu"
              aria-label="Main navigation"
              className="absolute right-0 top-[calc(100%+12px)] z-50 w-64 rounded-xl border border-[#D7E0EB] bg-white p-3 text-[#25334A] shadow-xl"
            >
              <div className="space-y-1">

                {/* DISCOVER PRODUCTS */}
                <Link
                  to="/discover"
                  onClick={closeMenu}
                  aria-current={
                    isDiscover ? "page" : undefined
                  }
                  className={`${menuItemStyle} ${
                    isDiscover
                      ? "bg-[#FFFAE9] font-semibold text-[#0F172A]"
                      : "text-[#475569] hover:bg-[#F3F6FA]"
                  }`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="19"
                    height="19"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path d="m16 16 5 5" />
                  </svg>

                  <span>Discover Products</span>
                </Link>

                {/* OPPORTUNITY RESULTS (only once one exists) */}
                {hasOpportunityResult && (
                  <Link
                    to="/product-overview"
                    onClick={closeMenu}
                    aria-current={
                      location.pathname === "/product-overview"
                        ? "page"
                        : undefined
                    }
                    className={menuLinkStyle(isOpportunity)}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="19"
                      height="19"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="9" />
                      <circle cx="12" cy="12" r="4" />
                    </svg>

                    <span>Opportunity results</span>
                  </Link>
                )}

                {/* SALES FORECAST (only once one exists) */}
                {hasSalesForecast && (
                  <Link
                    to="/sales-forecast-overview"
                    onClick={closeMenu}
                    aria-current={
                      isSalesForecast ? "page" : undefined
                    }
                    className={menuLinkStyle(isSalesForecast)}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="19"
                      height="19"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="m3 17 6-6 4 4 8-8" />
                      <path d="M15 7h6v6" />
                    </svg>

                    <span>Sales forecast</span>
                  </Link>
                )}

                {/* LAUNCH FORECAST (only once one exists) */}
                {hasLaunchForecast && (
                  <Link
                    to="/launch-forecast"
                    onClick={closeMenu}
                    aria-current={
                      isLaunchForecast ? "page" : undefined
                    }
                    className={menuLinkStyle(isLaunchForecast)}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="19"
                      height="19"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2.1-.1-2.9a2.2 2.2 0 0 0-2.9-.1z" />
                      <path d="M12 15l-3-3a22 22 0 0 1 2-3.9A12.9 12.9 0 0 1 22 2c0 2.7-.8 7.5-6 11a22.4 22.4 0 0 1-4 2z" />
                      <path d="M9 12H4s.6-3 2-4c1.6-1.1 5 0 5 0" />
                      <path d="M12 15v5s3-.6 4-2c1.1-1.6 0-5 0-5" />
                    </svg>

                    <span>Launch forecast</span>
                  </Link>
                )}

                {/* SAVED PRODUCTS */}
                <button
                  type="button"
                  onClick={() =>
                    handlePlaceholder("Saved Products")
                  }
                  className={`${menuItemStyle} text-[#475569] hover:bg-[#F3F6FA]`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="19"
                    height="19"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18l-6-4-6 4z" />
                  </svg>

                  <span>Saved Products</span>
                </button>

                {/* PROFILE */}
                <button
                  type="button"
                  onClick={() =>
                    handlePlaceholder("Profile")
                  }
                  className={`${menuItemStyle} text-[#475569] hover:bg-[#F3F6FA]`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="19"
                    height="19"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 21a8 8 0 0 1 16 0" />
                  </svg>

                  <span>Profile</span>
                </button>
              </div>

              {/* LOG OUT */}
              <div className="mt-3 border-t border-[#E7ECF3] pt-3">
                <button
                  type="button"
                  onClick={() =>
                    handlePlaceholder("Log Out")
                  }
                  className={`${menuItemStyle} text-[#B45353] hover:bg-red-50`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="19"
                    height="19"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M10 17l5-5-5-5" />
                    <path d="M15 12H3" />
                    <path d="M12 3h6a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-6" />
                  </svg>

                  <span>Log Out</span>
                </button>
              </div>

              {/* PLACEHOLDER FEEDBACK */}
              {notice && (
                <div
                  role="status"
                  aria-live="polite"
                  className="mt-3 rounded-lg border border-[#D7E0EB] bg-[#F6F9FD] px-4 py-3"
                >
                  <p className="text-xs font-medium text-[#193B66]">
                    {notice}
                  </p>
                </div>
              )}
            </nav>
          )}
        </div>
      </div>
    </header>
  );
}
