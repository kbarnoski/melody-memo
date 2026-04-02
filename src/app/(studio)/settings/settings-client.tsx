"use client";

import { Monitor, ExternalLink } from "lucide-react";

const DESKTOP_DOWNLOAD_URL =
  "https://github.com/kbarnoski/melody-memo/releases/latest/download/Resonance_0.1.0_aarch64.dmg";

export function SettingsClient() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-light tracking-tight text-white/90">
          Settings
        </h1>
        <p className="mt-1 text-sm text-white/40">
          Manage your Resonance experience
        </p>
      </div>

      {/* Desktop App */}
      <section className="space-y-4">
        <h2 className="text-sm font-medium uppercase tracking-wider text-white/30">
          Desktop App
        </h2>
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.06]">
              <Monitor className="h-5 w-5 text-white/50" />
            </div>
            <div className="flex-1 space-y-1.5">
              <h3 className="text-sm font-medium text-white/80">
                Resonance for macOS
              </h3>
              <p className="text-sm leading-relaxed text-white/40">
                Native desktop app with true kiosk mode — no browser chrome, no
                &ldquo;Press Escape&rdquo; overlays. Ideal for The Room,
                installation mode, and live performance.
              </p>
            </div>
            <a
              href={DESKTOP_DOWNLOAD_URL}
              className="inline-flex shrink-0 items-center gap-2 rounded-md bg-white/[0.08] px-4 py-2 text-sm text-white/70 transition-colors hover:bg-white/[0.12] hover:text-white/90"
            >
              Download
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
