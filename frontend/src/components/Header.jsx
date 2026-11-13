
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Bookmark,
  ChevronDown,
  LogOut,
  Menu,
  ScanSearch,
  Search,
  UserRound,
} from "lucide-react";

// ========================================
// SHARED MENU STYLES
// ========================================

const menuItemStyle =
  "flex w-full items-center gap-3 rounded-md " +
  "px-4 py-3 text-left text-sm font-medium " +
  "transition-colors duration-150 " +
  "focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 " +
  "focus-visible:outline-primary";

// ========================================
// HEADER
// ========================================

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState("");

  const menuRef = useRef(null);
  const toggleRef = useRef(null);

  const location = useLocation();

  const isDiscover =
    location.pathname === "/discover";

  // ========================================
  // MENU ACTIONS
  // ========================================

  function closeMenu() {
    setMenuOpen(false);
    setNotice("");
  }

  function toggleMenu() {
    setMenuOpen((previous) => !previous);
    setNotice("");
  }

  function handlePlaceholder(feature) {
    setNotice(`${feature} is coming soon.`);
  }

  // ========================================
  // KEYBOARD AND OUTSIDE CLICK
  // ========================================

  useEffect(() => {
    if (!menuOpen) return;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setNotice("");
        toggleRef.current?.focus();
      }
    }

    function handlePointerDown(event) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target)
      ) {
        setMenuOpen(false);
        setNotice("");
      }
    }

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    document.addEventListener(
      "pointerdown",
      handlePointerDown
    );

    return () => {
      document.removeEventListener(
        "keydown",
        handleKeyDown
      );

      document.removeEventListener(
        "pointerdown",
        handlePointerDown
      );
    };
  }, [menuOpen]);

  // ========================================
  // RENDER
  // ========================================

  return (
    <header className="sticky top-0 z-40 border-b border-ink bg-background">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">

        {/* ========================================
            EXACT LANDING PAGE LOGO
        ======================================== */}

        <Link
          to="/"
          onClick={closeMenu}
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

        {/* ========================================
            COLLAPSIBLE NAVIGATION
        ======================================== */}

        <div
          ref={menuRef}
          className="relative shrink-0"
        >

          {/* MENU BUTTON */}

          <button
            ref={toggleRef}
            type="button"
            onClick={toggleMenu}
            aria-expanded={menuOpen}
            aria-controls="marketlens-menu"
            aria-label={
              menuOpen
                ? "Close navigation menu"
                : "Open navigation menu"
            }
            aria-haspopup="true"
            className={
              "inline-flex items-center gap-2 " +
              "rounded-md border border-ink bg-ink " +
              "px-4 py-2 text-sm font-medium " +
              "text-ink-foreground shadow-offset-sm " +
              "transition-all duration-150 " +
              "hover:translate-x-[1px] " +
              "hover:translate-y-[1px] " +
              "hover:shadow-none " +
              "focus-visible:outline-2 " +
              "focus-visible:outline-offset-4 " +
              "focus-visible:outline-primary"
            }
          >
            <span>Menu</span>

            <Menu
              size={17}
              strokeWidth={1.8}
              aria-hidden="true"
            />

            <ChevronDown
              size={15}
              strokeWidth={1.8}
              aria-hidden="true"
              className={
                "transition-transform duration-150 " +
                (menuOpen ? "rotate-180" : "")
              }
            />
          </button>

          {/* ========================================
              FLOATING DROPDOWN

              Does not expand the header.
              Does not shift the page content.
          ======================================== */}

          {menuOpen && (
            <nav
              id="marketlens-menu"
              aria-label="Main navigation"
              className={
                "absolute right-0 top-full z-50 " +
                "mt-3 w-[min(18rem,calc(100vw-2.5rem))] " +
                "rounded-md border border-ink " +
                "bg-card p-2 text-foreground " +
                "shadow-offset"
              }
            >
              <div className="space-y-1">

                {/* DISCOVER PRODUCTS */}

                <Link
                  to="/discover"
                  onClick={closeMenu}
                  aria-current={
                    isDiscover
                      ? "page"
                      : undefined
                  }
                  className={
                    menuItemStyle +
                    " " +
                    (isDiscover
                      ? "bg-secondary font-semibold text-foreground"
                      : "text-muted-foreground hover:bg-secondary")
                  }
                >
                  <Search
                    size={18}
                    strokeWidth={1.8}
                    className="shrink-0"
                    aria-hidden="true"
                  />

                  <span>
                    Discover Products
                  </span>

                  {isDiscover && (
                    <span
                      className="ml-auto size-1.5 rounded-full bg-primary"
                      aria-hidden="true"
                    />
                  )}
                </Link>

                {/* SAVED PRODUCTS */}

                <button
                  type="button"
                  onClick={() =>
                    handlePlaceholder("Saved Products")
                  }
                  className={
                    menuItemStyle +
                    " text-muted-foreground hover:bg-secondary"
                  }
                >
                  <Bookmark
                    size={18}
                    strokeWidth={1.8}
                    className="shrink-0"
                    aria-hidden="true"
                  />

                  <span>
                    Saved Products
                  </span>
                </button>

                {/* PROFILE */}

                <button
                  type="button"
                  onClick={() =>
                    handlePlaceholder("Profile")
                  }
                  className={
                    menuItemStyle +
                    " text-muted-foreground hover:bg-secondary"
                  }
                >
                  <UserRound
                    size={18}
                    strokeWidth={1.8}
                    className="shrink-0"
                    aria-hidden="true"
                  />

                  <span>
                    Profile
                  </span>
                </button>
              </div>

              {/* ========================================
                  LOG OUT
              ======================================== */}

              <div className="mt-2 border-t border-border pt-2">
                <button
                  type="button"
                  onClick={() =>
                    handlePlaceholder("Log Out")
                  }
                  className={
                    menuItemStyle +
                    " text-[#B04435] hover:bg-secondary"
                  }
                >
                  <LogOut
                    size={18}
                    strokeWidth={1.8}
                    className="shrink-0"
                    aria-hidden="true"
                  />

                  <span>
                    Log Out
                  </span>
                </button>
              </div>

              {/* ========================================
                  PLACEHOLDER FEEDBACK
              ======================================== */}

              {notice && (
                <div
                  role="status"
                  aria-live="polite"
                  className={
                    "mt-3 border-l-2 border-primary " +
                    "bg-secondary px-4 py-3"
                  }
                >
                  <p className="text-xs leading-5 text-foreground">
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
