"use client";

import { useEffect, useState } from "react";

function resolveColor(varName: string): string {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  const el = document.createElement("div");
  el.style.color = value;
  document.body.appendChild(el);
  const resolved = getComputedStyle(el).color;
  el.remove();
  return resolved;
}

function resolveAll() {
  return {
    primary: resolveColor("--primary"),
    mutedForeground: resolveColor("--muted-foreground"),
    chart1: resolveColor("--chart-1"),
  };
}

export function useThemeColors() {
  const [colors, setColors] = useState({
    primary: "rgb(80, 60, 200)",
    mutedForeground: "rgb(150, 150, 150)",
    chart1: "rgb(80, 60, 200)",
  });

  useEffect(() => {
    // Resolve on mount
    const id = requestAnimationFrame(() => setColors(resolveAll()));

    // Re-resolve when theme class changes on <html>
    const observer = new MutationObserver(() => {
      requestAnimationFrame(() => setColors(resolveAll()));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      cancelAnimationFrame(id);
      observer.disconnect();
    };
  }, []);

  return colors;
}
