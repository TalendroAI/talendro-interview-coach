import { useEffect } from "react";
import { useLocation } from "react-router-dom";

function scrollElementToTop(el: Element | null) {
  if (!el) return;
  if (!(el instanceof HTMLElement)) return;

  try {
    el.scrollTo({ top: 0, left: 0, behavior: "auto" });
  } catch {
    // Fallback for older browsers / non-scrollable elements
    el.scrollTop = 0;
    el.scrollLeft = 0;
  }
}

/**
 * Global scroll reset on navigation.
 *
 * React Router preserves scroll position by default; this ensures every route
 * change starts at the top (including query string changes).
 */
export function ScrollToTop() {
  const location = useLocation();

  useEffect(() => {
    const doScroll = () => {
      // Page scroll
      try {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      } catch {
        window.scrollTo(0, 0);
      }

      // Common scroll containers across the app
      scrollElementToTop(document.documentElement);
      scrollElementToTop(document.body);
      scrollElementToTop(document.querySelector("main"));
      scrollElementToTop(document.getElementById("main-scroll-container"));
      scrollElementToTop(document.getElementById("chat-messages-container"));
    };

    // Run after paint, and once more shortly after to catch late-mounted layouts.
    requestAnimationFrame(doScroll);
    setTimeout(doScroll, 50);
  }, [location.key]);

  return null;
}
