// ========================================
// HEADER PLACEHOLDER
// ========================================

// Same size and look as the app header (h-16 plus a 1px border), shown while
// the session check runs so the page below doesn't move when the real header
// replaces it (#84).
export default function HeaderPlaceholder() {
  return (
    <header
      aria-hidden="true"
      className="sticky top-0 z-40 border-b border-ink bg-background"
    >
      <div className="mx-auto h-16 max-w-6xl" />
    </header>
  );
}
