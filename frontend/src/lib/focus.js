// Focus helpers for content that is swapped out under the keyboard user
// (#86). When the focused element disappears or is disabled, the browser
// drops focus to the page and screen readers announce nothing.

// Focus an element; one that is not focusable on its own gets
// tabindex="-1" and no focus outline (it is not a control).
export function focusElement(element) {
  if (!element) return;
  if (!element.hasAttribute("tabindex") && element.tabIndex < 0) {
    element.setAttribute("tabindex", "-1");
    element.setAttribute("data-route-target", "");
  }
  element.focus({ preventScroll: true });
}

// When the focused element is about to be removed (a Try again button
// whose notice goes away), keep focus on whatever takes its place: the
// element that follows `previous` inside `parent`, or `parent` itself.
// That slot may change more than once (a loading message, then the
// result), so it follows along for a few seconds, and stops as soon as the
// user moves focus elsewhere.
export function focusSlotAfter(previous, parent, { timeout = 10000 } = {}) {
  if (!parent) return;

  let observer;
  let timeoutId;

  const stop = () => {
    observer?.disconnect();
    clearTimeout(timeoutId);
  };

  const refocus = () => {
    if (!parent.isConnected) return stop();

    const active = document.activeElement;
    const lost = !active || active === document.body;
    if (!lost) {
      if (!parent.contains(active)) stop();
      return;
    }

    const next = previous?.isConnected
      ? previous.nextElementSibling
      : parent.firstElementChild;
    focusElement(next || parent);
  };

  requestAnimationFrame(refocus);
  observer = new MutationObserver(refocus);
  observer.observe(parent, { childList: true });
  timeoutId = setTimeout(stop, timeout);
}
