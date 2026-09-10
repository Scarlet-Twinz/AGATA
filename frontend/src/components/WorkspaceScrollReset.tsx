import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

export function WorkspaceScrollReset() {
  const location = useLocation();

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });

    const navigation = document.querySelector<HTMLElement>(".agata-nav");
    if (navigation) navigation.scrollTop = 0;
  }, [location.pathname]);

  return null;
}
