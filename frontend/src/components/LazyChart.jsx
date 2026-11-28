import { useEffect, useRef, useState } from "react";

// ========================================
// LAZY CHART
// ========================================

// The chart library is about 100 kB of compressed JavaScript. Pages that
// imported it directly could not show anything, headline figures
// included, until it had downloaded (#91: LCP about 3.4 s on mobile). A
// chart drawn with LazyChart loads the library only when it comes near
// the screen, so the page text shows first.
//
// Usage: put it inside a box of fixed height (that box keeps the space,
// so nothing moves when the chart appears) and pass a function that draws
// the chart with the library's components:
//
//   <LazyChart>
//     {({ ResponsiveContainer, BarChart, Bar }) => (
//       <ResponsiveContainer>...</ResponsiveContainer>
//     )}
//   </LazyChart>

let library = null;
let loading = null;

function loadLibrary() {
  loading ??= import("./chartLibrary").then((module) => {
    library = module;
    return module;
  });
  return loading;
}

export default function LazyChart({ children: draw }) {
  const ref = useRef(null);
  const [charts, setCharts] = useState(library);

  useEffect(() => {
    if (charts) return undefined;

    let active = true;
    const show = () =>
      loadLibrary().then((module) => {
        if (active) setCharts(module);
      });

    if (typeof IntersectionObserver === "undefined") {
      show();
      return () => {
        active = false;
      };
    }

    // Start a little before the chart scrolls into view.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          show();
        }
      },
      { rootMargin: "400px 0px" }
    );
    observer.observe(ref.current);

    return () => {
      active = false;
      observer.disconnect();
    };
  }, [charts]);

  return (
    <div ref={ref} className="h-full w-full">
      {charts ? draw(charts) : null}
    </div>
  );
}
