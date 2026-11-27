// Single-choice button groups (analysis cards, timeframe switches, preset
// chips) follow the WAI-ARIA radio group pattern: the container has
// role="radiogroup", each option role="radio" with aria-checked, only one
// option is in the tab order, and the arrow keys move to and select the
// next option, as native radio buttons do.

const NEXT_KEYS = new Set(["ArrowRight", "ArrowDown"]);
const PREVIOUS_KEYS = new Set(["ArrowLeft", "ArrowUp"]);

// Index to move to from `current` among `count` options, or -1 when the
// key does not move. Wraps at both ends; Home and End jump to the ends.
export function nextRadioIndex(current, count, key) {
  if (count < 1) return -1;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  if (NEXT_KEYS.has(key)) return (current + 1) % count;
  if (PREVIOUS_KEYS.has(key)) return (current - 1 + count) % count;
  return -1;
}

// onKeyDown for the role="radiogroup" container. Disabled options are
// skipped. Moving clicks the option so its own onClick selects it.
export function handleRadioGroupKeyDown(event) {
  const radios = [
    ...event.currentTarget.querySelectorAll(
      '[role="radio"]:not([disabled])'
    ),
  ];
  const current = radios.indexOf(document.activeElement);
  if (current === -1) return;

  const next = nextRadioIndex(current, radios.length, event.key);
  if (next === -1) return;

  event.preventDefault();
  radios[next].focus();
  radios[next].click();
}

// Props for one option. Only the checked option is tabbable; when none is
// checked, the first one is, so the group can still be reached by Tab.
export function radioProps(checked, isFirst, anyChecked = true) {
  return {
    role: "radio",
    "aria-checked": checked,
    tabIndex: checked || (!anyChecked && isFirst) ? 0 : -1,
  };
}
