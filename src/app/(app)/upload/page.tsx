"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { Upload, X, FileAudio, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface UploadingFile {
  file: File;
  progress: number;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

export default function UploadPage() {
  const [files, setFiles] = useState<UploadingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const audioFiles = Array.from(newFiles).filter((f) =>
      f.type.startsWith("audio/") || f.name.endsWith(".m4a") || f.name.endsWith(".mp3") || f.name.endsWith(".wav")
    );
    if (audioFiles.length === 0) {
      toast.error("Please select audio files (M4A, MP3, WAV)");
      return;
    }
    setFiles((prev) => [
      ...prev,
      ...audioFiles.map((file) => ({ file, progress: 0, status: "pending" as const })),
    ]);
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function uploadAll() {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user) {
      toast.error(authError?.message ?? "Not logged in. Please sign in first.");
      return;
    }

    for (let i = 0; i < files.length; i++) {
      if (files[i].status === "done") continue;

      setFiles((prev) =>
        prev.map((f, idx) => (idx === i ? { ...f, status: "uploading", progress: 10 } : f))
      );

      const file = files[i].file;
      const fileName = `${user.id}/${Date.now()}-${file.name}`;

      setFiles((prev) =>
        prev.map((f, idx) => (idx === i ? { ...f, progress: 30 } : f))
      );

      const { error: uploadError } = await supabase.storage
        .from("recordings")
        .upload(fileName, file, {
          contentType: file.type || "audio/mp4",
          upsert: false,
        });

      if (uploadError) {
        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, status: "error", error: `Storage: ${uploadError.message}` } : f
          )
        );
        continue;
      }

      setFiles((prev) =>
        prev.map((f, idx) => (idx === i ? { ...f, progress: 70 } : f))
      );

      // Determine duration from original file bytes
      let duration: number | null = null;
      try {
        const arrayBuffer = await file.arrayBuffer();
        const audioCtx = new AudioContext();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        duration = audioBuffer.duration;
        await audioCtx.close();
      } catch {
        // Duration detection failed, continue without it
      }

      const title = file.name.replace(/\.[^/.]+$/, "");

      const { error: dbError } = await supabase.from("recordings").insert({
        user_id: user.id,
        title,
        file_name: fileName,
        audio_url: fileName, // stored path, we'll proxy via /api/audio/[id]
        duration,
        file_size: file.size,
      }).select("id").single();

      if (dbError) {
        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, status: "error", error: `Database: ${dbError.message} (code: ${dbError.code})` } : f
          )
        );
        continue;
      }

      setFiles((prev) =>
        prev.map((f, idx) => (idx === i ? { ...f, status: "done", progress: 100 } : f))
      );
    }

    toast.success("Upload complete!");
    // If only one file, go straight to it for analysis; otherwise go to library
    const doneFiles = files.filter((f) => f.status === "done");
    if (doneFiles.length === 1) {
      setTimeout(() => router.push("/library"), 1000);
    } else {
      setTimeout(() => router.push("/library"), 1500);
    }
  }

  const pendingCount = files.filter((f) => f.status !== "done").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Upload Recordings</h1>
        <p className="text-muted-foreground">
          Drag and drop your voice memos or click to browse
        </p>
      </div>

      <Card
        className={`border-2 border-dashed transition-colors cursor-pointer ${
          isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"
        }`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Upload className="mb-4 h-10 w-10 text-muted-foreground" />
          <p className="mb-2 text-lg font-medium">Drop audio files here</p>
          <p className="mb-4 text-sm text-muted-foreground">
            Supports M4A, MP3, WAV
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.m4a,.mp3,.wav"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />
          <Button variant="outline" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
            Browse Files
          </Button>
        </CardContent>
      </Card>

      {files.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{files.length} file(s) selected</h2>
            <Button onClick={uploadAll} disabled={pendingCount === 0}>
              Upload {pendingCount > 0 ? `(${pendingCount})` : ""}
            </Button>
          </div>

          {files.map((f, i) => (
            <Card key={i}>
              <CardContent className="flex items-center gap-3 py-3">
                <FileAudio className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">{f.file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(f.file.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                  {f.status === "uploading" && (
                    <div className="mt-1 h-1.5 w-full rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${f.progress}%` }}
                      />
                    </div>
                  )}
                  {f.status === "error" && (
                    <p className="text-xs text-destructive">{f.error}</p>
                  )}
                </div>
                {f.status === "done" ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFile(i)}
                    className="shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
