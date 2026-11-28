// Shared button class strings (#50: primaryButton had five copies in three
// versions). Pages add to these rather than redefining them.

// Keyboard focus outline for buttons and button-like links.
export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-4 " +
  "focus-visible:outline-primary";

// The vermilion call-to-action with the offset shadow and press effect.
export const primaryButton =
  "inline-flex items-center justify-center gap-3 " +
  "border border-ink bg-primary px-6 py-3 " +
  "font-semibold text-primary-foreground shadow-offset " +
  "transition-transform duration-150 " +
  "hover:translate-x-[2px] hover:translate-y-[2px] " +
  focusRing;

// Disabled styling for a primaryButton that can be disabled: no press
// effect, dimmed, not-allowed cursor.
// aria-disabled="true" looks the same: buttons that are busy use it instead
// of disabled so they keep keyboard focus (#86).
export const primaryButtonDisabled =
  "disabled:cursor-not-allowed disabled:opacity-50 " +
  "disabled:hover:translate-x-0 disabled:hover:translate-y-0 " +
  "aria-disabled:cursor-not-allowed aria-disabled:opacity-50 " +
  "aria-disabled:hover:translate-x-0 aria-disabled:hover:translate-y-0";
