"use client";

import { useEffect } from "react";

export function StudioTracker() {
  useEffect(() => {
    localStorage.setItem("resonance-last-experience", "chosen");
  }, []);
  return null;
}
