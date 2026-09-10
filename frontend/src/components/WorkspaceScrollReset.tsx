import { useEffect, useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

export function WorkspaceScrollReset() {
  const location = useLocation();

  useLayoutEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  useEffect(() => {
    const resetScroll = () => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;

      const navigation = document.querySelector<HTMLElement>(".agata-nav");
      if (navigation) navigation.scrollTop = 0;
    };

    resetScroll();

    const frame = window.requestAnimationFrame(() => {
      resetScroll();
      window.requestAnimationFrame(resetScroll);
    });

    const timer = window.setTimeout(resetScroll, 0);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [location.pathname]);

  return null;
}
