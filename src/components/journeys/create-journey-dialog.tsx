"use client";

import { useState, useEffect, useRef } from "react";
import { X, Loader2, Music, Image as ImageIcon, Upload } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { getMp4CreationDate } from "@/lib/audio/mp4-creation-date";
import { detectAudioCodec } from "@/lib/audio/detect-codec";
import type { Journey } from "@/lib/journeys/types";

interface CreateJourneyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordingId?: string;
  onCreated?: (journey: Journey) => void;
}

export function CreateJourneyDialog({
  open,
  onOpenChange,
  recordingId,
  onCreated,
}: CreateJourneyDialogProps) {
  const [journeyName, setJourneyName] = useState("");
  const [storyText, setStoryText] = useState("");
  const [audioReactive, setAudioReactive] = useState(false);
  const [creating, setCreating] = useState(false);
  const [statusText, setStatusText] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const [recordings, setRecordings] = useState<{ id: string; title: string }[]>([]);
  const [selectedRecordingId, setSelectedRecordingId] = useState<string | null>(recordingId ?? null);
  // Local-image source: when files are chosen, journey playback cycles these instead of calling fal.ai
  const [localImageFiles, setLocalImageFiles] = useState<File[]>([]);
  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[] | null>(null);
  // New-track upload: when set, the dialog uploads this audio file before journey creation
  // and uses the resulting recording as the journey's source.
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioArtist, setAudioArtist] = useState("");
  const [audioTitle, setAudioTitle] = useState("");

  // Fetch recordings when dialog opens
  useEffect(() => {
    if (!open) return;
    const fetchRecordings = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data, error } = await supabase
          .from("recordings")
          .select("id, title")
          .order("created_at", { ascending: false });
        if (!error && data) {
          setRecordings(data);
        }
      } catch {}
    };
    fetchRecordings();
  }, [open]);

  // Cycle status text while creating
  useEffect(() => {
    if (!creating) {
      setStatusText("");
      return;
    }
    const messages = [
      "Reading your story...",
      "Imagining the visual world...",
      "Choosing shaders & palette...",
      "Composing phases...",
      "Building the journey...",
      "Almost there...",
    ];
    let i = 0;
    setStatusText(messages[0]);
    const interval = setInterval(() => {
      i = Math.min(i + 1, messages.length - 1);
      setStatusText(messages[i]);
    }, 8000);
    return () => clearInterval(interval);
  }, [creating]);

  const handleCreate = async () => {
    if (!storyText.trim()) return;
    if (audioFile && !audioArtist.trim()) {
      toast.error("Artist name is required for uploaded tracks");
      return;
    }

    setCreating(true);
    abortRef.current = new AbortController();

    try {
      // If a new audio track was provided, upload + insert it first and use
      // the resulting recording id as the journey source. Bypasses the picker.
      let effectiveRecordingId: string | null = selectedRecordingId || recordingId || null;
      if (audioFile) {
        setStatusText("Uploading track...");
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not signed in");
        const fileName = `${user.id}/${Date.now()}-${audioFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("recordings")
          .upload(fileName, audioFile, {
            contentType: audioFile.type || "audio/mp4",
            upsert: false,
          });
        if (uploadError) {
          throw new Error(`Upload failed: ${uploadError.message}`);
        }

        // Detect duration via HTML Audio element
        let duration: number | null = null;
        try {
          duration = await new Promise<number | null>((resolve) => {
            const audio = new Audio();
            audio.preload = "metadata";
            audio.onloadedmetadata = () => {
              resolve(isFinite(audio.duration) ? audio.duration : null);
              URL.revokeObjectURL(audio.src);
            };
            audio.onerror = () => {
              resolve(null);
              URL.revokeObjectURL(audio.src);
            };
            audio.src = URL.createObjectURL(audioFile);
          });
        } catch {}

        const trackTitle = audioTitle.trim() || audioFile.name.replace(/\.[^/.]+$/, "");
        const mp4Date = await getMp4CreationDate(audioFile);
        const recordedAt = mp4Date
          ? mp4Date.toISOString()
          : audioFile.lastModified
            ? new Date(audioFile.lastModified).toISOString()
            : null;
        const audioCodec = await detectAudioCodec(audioFile);

        const { data: insertedRow, error: dbError } = await supabase
          .from("recordings")
          .insert({
            user_id: user.id,
            title: trackTitle,
            file_name: fileName,
            audio_url: fileName,
            duration,
            file_size: audioFile.size,
            recorded_at: recordedAt,
            audio_codec: audioCodec,
            artist: audioArtist.trim(),
          })
          .select("id")
          .single();
        if (dbError || !insertedRow) {
          throw new Error(`Couldn't save recording: ${dbError?.message ?? "unknown error"}`);
        }
        effectiveRecordingId = insertedRow.id;
      }

      // If local images were chosen, upload them first and collect public URLs
      let finalImageUrls: string[] | null = uploadedImageUrls;
      if (localImageFiles.length > 0 && !finalImageUrls) {
        setStatusText(`Uploading ${localImageFiles.length} photo${localImageFiles.length === 1 ? "" : "s"}...`);
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not signed in");
        const urls: string[] = [];
        for (const file of localImageFiles) {
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
          const { error: uploadError } = await supabase.storage
            .from("journey-images")
            .upload(path, file, {
              contentType: file.type || "image/jpeg",
              upsert: false,
            });
          if (uploadError) {
            throw new Error(`Upload failed: ${uploadError.message}`);
          }
          const { data: publicData } = supabase.storage
            .from("journey-images")
            .getPublicUrl(path);
          urls.push(publicData.publicUrl);
        }
        finalImageUrls = urls;
        setUploadedImageUrls(urls);
      }

      const res = await fetch("/api/journeys/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyText: storyText.trim(),
          recordingId: effectiveRecordingId,
          name: journeyName.trim() || undefined,
          audioReactive,
          localImageUrls: finalImageUrls ?? undefined,
        }),
        signal: abortRef.current.signal,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create journey");
      }

      toast.success(`Journey "${data.journey.name}" created`);
      onOpenChange(false);
      setStoryText("");
      setJourneyName("");
      setAudioReactive(false);
      setLocalImageFiles([]);
      setUploadedImageUrls(null);
      setAudioFile(null);
      setAudioArtist("");
      setAudioTitle("");
      const fullJourney: Journey = {
        ...data.journey,
        id: data.dbRecord.id,
        storyText: storyText.trim(),
        recordingId: effectiveRecordingId,
        userId: data.dbRecord.user_id,
        audioReactive,
        ...(finalImageUrls && finalImageUrls.length > 0 ? { localImageUrls: finalImageUrls } : {}),
      };
      onCreated?.(fullJourney);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(msg);
    } finally {
      setCreating(false);
      abortRef.current = null;
    }
  };

  const handleCancel = () => {
    if (creating && abortRef.current) {
      abortRef.current.abort();
    }
    setCreating(false);
    onOpenChange(false);
  };

  if (!open) return null;

  const accent = "#8b5cf6"; // app purple

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[90] transition-opacity duration-300"
        style={{
          backdropFilter: "blur(32px) saturate(1.2)",
          WebkitBackdropFilter: "blur(32px) saturate(1.2)",
          backgroundColor: "rgba(0, 0, 0, 0.75)",
        }}
        onClick={handleCancel}
      />

      {/* Content */}
      <div className="fixed inset-0 z-[90] flex items-center justify-center p-8 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-lg"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2
                className="text-white/90 text-xl tracking-tight"
                style={{ fontFamily: "var(--font-geist-sans)", fontWeight: 200 }}
              >
                Create a Journey
              </h2>
              <p
                className="text-white/30 mt-1"
                style={{ fontSize: "0.75rem", fontFamily: "var(--font-geist-mono)" }}
              >
                Describe a story, memory, or intention
              </p>
            </div>
            <button
              onClick={handleCancel}
              className="p-2 rounded-lg text-white/30 hover:text-white/60 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Journey name */}
          <div className="mb-5">
            <label
              className="block text-white/40 mb-2"
              style={{ fontSize: "0.7rem", fontFamily: "var(--font-geist-mono)", letterSpacing: "0.05em", textTransform: "uppercase" }}
            >
              Name
            </label>
            <input
              type="text"
              placeholder="Leave blank to auto-generate"
              value={journeyName}
              onChange={(e) => setJourneyName(e.target.value)}
              disabled={creating}
              className="w-full rounded-xl px-4 py-2.5 text-white/80 placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-white/20 transition-colors disabled:opacity-50"
              style={{
                fontSize: "0.9rem",
                fontFamily: "var(--font-geist-sans)",
                backgroundColor: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            />
          </div>

          {/* Story input */}
          <div className="mb-5">
            <label
              className="block text-white/40 mb-2"
              style={{ fontSize: "0.7rem", fontFamily: "var(--font-geist-mono)", letterSpacing: "0.05em", textTransform: "uppercase" }}
            >
              Your story
            </label>
            <textarea
              placeholder="A walk through autumn woods at dusk, leaves turning to gold..."
              value={storyText}
              onChange={(e) => setStoryText(e.target.value)}
              rows={3}
              disabled={creating}
              className="w-full rounded-xl px-4 py-3 text-white/80 placeholder:text-white/20 resize-none focus:outline-none focus:ring-1 focus:ring-white/20 transition-colors disabled:opacity-50"
              style={{
                fontSize: "0.9rem",
                fontFamily: "var(--font-geist-sans)",
                backgroundColor: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                lineHeight: 1.6,
              }}
            />
          </div>

          {/* Song picker */}
          {recordings.length > 0 && (
            <div className="mb-6">
              <label
                className="block text-white/40 mb-2"
                style={{ fontSize: "0.7rem", fontFamily: "var(--font-geist-mono)", letterSpacing: "0.05em", textTransform: "uppercase" }}
              >
                <Music className="inline h-3 w-3 mr-1 -mt-0.5" />
                Song
              </label>
              <div className="max-h-32 overflow-y-auto scrollbar-thin pr-1 space-y-1">
                <button
                  type="button"
                  onClick={() => !creating && setSelectedRecordingId(null)}
                  disabled={creating}
                  className={`w-full rounded-lg px-3 py-2 text-left transition-all ${
                    selectedRecordingId === null ? "text-white/90" : "text-white/40 hover:text-white/60 hover:bg-white/3"
                  }`}
                  style={{
                    fontSize: "0.75rem",
                    fontFamily: "var(--font-geist-sans)",
                    fontWeight: selectedRecordingId === null ? 400 : 300,
                    backgroundColor: selectedRecordingId === null ? `${accent}18` : "transparent",
                    border: selectedRecordingId === null ? `1px solid ${accent}40` : "1px solid rgba(255,255,255,0.04)",
                  }}
                >
                  None (use any track)
                </button>
                {recordings.map((rec) => (
                  <button
                    key={rec.id}
                    type="button"
                    onClick={() => !creating && setSelectedRecordingId(rec.id)}
                    disabled={creating}
                    className={`w-full rounded-lg px-3 py-2 text-left transition-all truncate ${
                      selectedRecordingId === rec.id ? "text-white/90" : "text-white/40 hover:text-white/60 hover:bg-white/3"
                    }`}
                    style={{
                      fontSize: "0.75rem",
                      fontFamily: "var(--font-geist-sans)",
                      fontWeight: selectedRecordingId === rec.id ? 400 : 300,
                      backgroundColor: selectedRecordingId === rec.id ? `${accent}18` : "transparent",
                      border: selectedRecordingId === rec.id ? `1px solid ${accent}40` : "1px solid rgba(255,255,255,0.04)",
                    }}
                  >
                    {rec.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Upload a new track — when set, this audio is uploaded and used as the journey source */}
          <div className="mb-5">
            <label
              className="block text-white/40 mb-2"
              style={{ fontSize: "0.7rem", fontFamily: "var(--font-geist-mono)", letterSpacing: "0.05em", textTransform: "uppercase" }}
            >
              <Upload className="inline h-3 w-3 mr-1 -mt-0.5" />
              Or upload a new track
            </label>
            <input
              type="file"
              accept="audio/*,.m4a,.mp3,.wav,.flac"
              disabled={creating}
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setAudioFile(file);
                if (file) {
                  // Selecting a new track overrides any picked recording
                  setSelectedRecordingId(null);
                  if (!audioTitle) setAudioTitle(file.name.replace(/\.[^/.]+$/, ""));
                }
              }}
              className="w-full text-xs text-white/60 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-white/10 file:text-white/80 hover:file:bg-white/15 file:cursor-pointer disabled:opacity-50"
              style={{ fontFamily: "var(--font-geist-mono)" }}
            />
            {audioFile && (
              <div className="mt-3 space-y-2">
                <input
                  type="text"
                  placeholder="Track title"
                  value={audioTitle}
                  onChange={(e) => setAudioTitle(e.target.value)}
                  disabled={creating}
                  className="w-full rounded-lg px-3 py-2 text-white/80 placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-white/20 transition-colors disabled:opacity-50"
                  style={{
                    fontSize: "0.8rem",
                    fontFamily: "var(--font-geist-sans)",
                    backgroundColor: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                />
                <input
                  type="text"
                  placeholder="Artist (required)"
                  value={audioArtist}
                  onChange={(e) => setAudioArtist(e.target.value)}
                  disabled={creating}
                  className="w-full rounded-lg px-3 py-2 text-white/80 placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-white/20 transition-colors disabled:opacity-50"
                  style={{
                    fontSize: "0.8rem",
                    fontFamily: "var(--font-geist-sans)",
                    backgroundColor: "rgba(255,255,255,0.04)",
                    border: `1px solid ${audioArtist.trim() ? "rgba(255,255,255,0.08)" : `${accent}40`}`,
                  }}
                />
                <p className="text-white/40" style={{ fontSize: "0.65rem", fontFamily: "var(--font-geist-mono)" }}>
                  {audioFile.name} · {(audioFile.size / 1024 / 1024).toFixed(1)} MB — uploaded with the journey
                </p>
              </div>
            )}
          </div>

          {/* Your own photos — bypass AI imagery, cycle user-provided files */}
          <div className="mb-5">
            <label
              className="block text-white/40 mb-2"
              style={{ fontSize: "0.7rem", fontFamily: "var(--font-geist-mono)", letterSpacing: "0.05em", textTransform: "uppercase" }}
            >
              <ImageIcon className="inline h-3 w-3 mr-1 -mt-0.5" />
              Your own photos (optional)
            </label>
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={creating}
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                setLocalImageFiles(files);
                setUploadedImageUrls(null);
              }}
              className="w-full text-xs text-white/60 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-white/10 file:text-white/80 hover:file:bg-white/15 file:cursor-pointer disabled:opacity-50"
              style={{ fontFamily: "var(--font-geist-mono)" }}
            />
            {localImageFiles.length > 0 && (
              <p className="mt-2 text-white/40" style={{ fontSize: "0.65rem", fontFamily: "var(--font-geist-mono)" }}>
                {localImageFiles.length} photo{localImageFiles.length === 1 ? "" : "s"} selected — playback will cycle these instead of generating AI imagery
              </p>
            )}
          </div>

          {/* Audio reactive toggle */}
          <div className="mb-6">
            <button
              type="button"
              onClick={() => !creating && setAudioReactive(!audioReactive)}
              disabled={creating}
              className="flex items-center gap-3 w-full rounded-xl px-4 py-3 transition-colors disabled:opacity-50"
              style={{
                backgroundColor: audioReactive ? `${accent}18` : "rgba(255,255,255,0.04)",
                border: audioReactive ? `1px solid ${accent}40` : "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div
                className="w-8 h-4 rounded-full relative flex-shrink-0 transition-colors"
                style={{ backgroundColor: audioReactive ? accent : "rgba(255,255,255,0.15)" }}
              >
                <div
                  className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform"
                  style={{ transform: audioReactive ? "translateX(16px)" : "translateX(2px)" }}
                />
              </div>
              <div className="text-left">
                <span
                  className="block text-white/70"
                  style={{ fontSize: "0.8rem", fontFamily: "var(--font-geist-sans)" }}
                >
                  React to music
                </span>
                <span
                  className="block text-white/30"
                  style={{ fontSize: "0.65rem", fontFamily: "var(--font-geist-mono)" }}
                >
                  Shaders respond to audio frequencies
                </span>
              </div>
            </button>
          </div>

          {/* Create button */}
          <button
            onClick={handleCreate}
            disabled={creating || !storyText.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white/80 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              fontSize: "0.85rem",
              fontFamily: "var(--font-geist-mono)",
              backgroundColor: creating ? `${accent}15` : `${accent}20`,
              border: `1px solid ${accent}${creating ? "20" : "40"}`,
            }}
          >
            {creating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{statusText}</span>
              </>
            ) : (
              "Create Journey"
            )}
          </button>

          {creating && (
            <button
              onClick={handleCancel}
              className="w-full mt-2 px-4 py-2 text-white/30 hover:text-white/50 transition-colors"
              style={{ fontSize: "0.75rem", fontFamily: "var(--font-geist-mono)" }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </>
  );
}
