import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

function resetWorkspaceScroll() {
  const scrollingElement = document.scrollingElement;
  const previousBehavior = document.documentElement.style.scrollBehavior;

  // The global stylesheet uses smooth scrolling for the public site. Route
  // changes in the authenticated workspace must be deterministic instead.
  document.documentElement.style.scrollBehavior = "auto";

  window.scrollTo(0, 0);
  if (scrollingElement) {
    scrollingElement.scrollTop = 0;
    scrollingElement.scrollLeft = 0;
  }
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;

  const navigation = document.querySelector<HTMLElement>(".agata-nav");
  if (navigation) {
    navigation.scrollTop = 0;
    navigation.scrollLeft = 0;
  }

  document.documentElement.style.scrollBehavior = previousBehavior;
}

export function WorkspaceScrollReset() {
  const location = useLocation();

  useLayoutEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  useLayoutEffect(() => {
    resetWorkspaceScroll();

    const firstFrame = window.requestAnimationFrame(() => {
      resetWorkspaceScroll();

      window.requestAnimationFrame(() => {
        resetWorkspaceScroll();
      });
    });

    return () => window.cancelAnimationFrame(firstFrame);
  }, [location.key]);

  return null;
}
