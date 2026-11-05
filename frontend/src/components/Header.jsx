
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState("");

  const location = useLocation();

  const isDiscover = location.pathname === "/discover";

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
        <Link
          to="/discover"
          className="flex items-center gap-3"
          onClick={closeMenu}
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

        {/* NAVIGATION MENU */}
        <div className="relative">
          <button
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
