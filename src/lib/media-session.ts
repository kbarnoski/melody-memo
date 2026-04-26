/**
 * Web Media Session API integration — lock screen Now Playing metadata
 * and transport controls. Supported in WKWebView on iOS 16+.
 */

import type { Track } from "@/lib/audio/audio-store";

export function updateMediaSession(
  track: Track | null,
  journeyName?: string | null,
): void {
  if (!("mediaSession" in navigator)) return;

  if (!track) {
    navigator.mediaSession.metadata = null;
    return;
  }

  // When a journey is active, the journey IS the experience — show its
  // name on the OS lock screen / now-playing widget instead of the
  // underlying track filename (which is often an admin working name
  // like "KB_SFLAKE_v3"). Track artist remains the music credit.
  navigator.mediaSession.metadata = new MediaMetadata({
    title: journeyName ?? track.title,
    artist: "Resonance",
    album: "Recordings",
  });
}

export function setMediaSessionPlaybackState(
  state: "playing" | "paused" | "none"
): void {
  if (!("mediaSession" in navigator)) return;
  navigator.mediaSession.playbackState = state;
}

export function registerMediaSessionHandlers(handlers: {
  onPlay: () => void;
  onPause: () => void;
  onNextTrack?: () => void;
  onPreviousTrack?: () => void;
}): void {
  if (!("mediaSession" in navigator)) return;

  navigator.mediaSession.setActionHandler("play", handlers.onPlay);
  navigator.mediaSession.setActionHandler("pause", handlers.onPause);

  if (handlers.onNextTrack) {
    navigator.mediaSession.setActionHandler("nexttrack", handlers.onNextTrack);
  }
  if (handlers.onPreviousTrack) {
    navigator.mediaSession.setActionHandler(
      "previoustrack",
      handlers.onPreviousTrack
    );
  }
}
