"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Trash2, Share2, Copy, Check, Link } from "lucide-react";
import { toast } from "sonner";
import { WaveformPlayer, type WaveformPlayerHandle } from "@/components/audio/waveform-player";
import { AnalyzeButton } from "@/components/analysis/analyze-button";
import { AnalysisDisplay } from "@/components/analysis/analysis-display";
import { ChordTimeline } from "@/components/analysis/chord-timeline";
import { PianoRoll } from "@/components/analysis/piano-roll";
import { ExportMidiButton } from "@/components/analysis/export-midi-button";
import { ChatPanel } from "@/components/chat/chat-panel";
import { MarkersPanel, type Marker } from "@/components/markers/markers-panel";
import { Visualizer } from "@/components/audio/visualizer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface RecordingDetailProps {
  recording: {
    id: string;
    title: string;
    audio_url: string;
    duration: number | null;
    created_at: string;
    description: string | null;
    file_name: string;
    share_token: string | null;
    waveform_peaks: number[][] | null;
    audio_codec: string | null;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  analysis: any | null;
  initialMessages: {
    id: string;
    role: string;
    content: string;
    created_at: string;
  }[];
}

export function RecordingDetail({
  recording,
  analysis: initialAnalysis,
  initialMessages,
}: RecordingDetailProps) {
  const router = useRouter();
  const [analysis, setAnalysis] = useState(initialAnalysis);
  const [currentTime, setCurrentTime] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [showVisualizer, setShowVisualizer] = useState(false);
  const [description, setDescription] = useState(recording.description ?? "");
  const [shareToken, setShareToken] = useState(recording.share_token);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const playerRef = useRef<WaveformPlayerHandle>(null);

  const handleSeek = useCallback((time: number) => {
    playerRef.current?.seekTo(time);
  }, []);

  async function handleDelete() {
    setDeleting(true);
    const supabase = createClient();

    await supabase.storage.from("recordings").remove([recording.file_name]);

    const { error } = await supabase
      .from("recordings")
      .delete()
      .eq("id", recording.id);

    if (error) {
      toast.error(`Failed to delete: ${error.message}`);
      setDeleting(false);
      return;
    }

    toast.success("Recording deleted");
    router.push("/library");
  }

  async function saveDescription() {
    const trimmed = description.trim();
    if (trimmed === (recording.description ?? "")) return;
    const supabase = createClient();
    await supabase
      .from("recordings")
      .update({ description: trimmed || null })
      .eq("id", recording.id);
  }

  async function handleShare() {
    if (shareToken) {
      setShareDialogOpen(true);
      return;
    }
    setSharing(true);
    const token = crypto.randomUUID();
    const supabase = createClient();
    const { error } = await supabase
      .from("recordings")
      .update({ share_token: token })
      .eq("id", recording.id);
    if (error) {
      toast.error(`Failed to create share link: ${error.message}`);
      setSharing(false);
      return;
    }
    setShareToken(token);
    setSharing(false);
    setShareDialogOpen(true);
  }

  function getShareUrl() {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/share/${shareToken}`;
  }

  async function copyShareUrl() {
    try {
      await navigator.clipboard.writeText(getShareUrl());
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Input
          placeholder="Add a description..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={saveDescription}
          className="text-sm text-muted-foreground"
        />
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 text-muted-foreground hover:text-foreground"
          onClick={handleShare}
          disabled={sharing}
        >
          {shareToken ? <Link className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
        </Button>

        <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Share Recording</DialogTitle>
              <DialogDescription>
                Anyone with this link can view the recording and its analysis.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={getShareUrl()}
                className="font-mono text-xs"
              />
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={copyShareUrl}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 text-muted-foreground hover:text-destructive"
              disabled={deleting}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete recording?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete &ldquo;{recording.title}&rdquo; and remove its analysis, markers, and chat history. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <WaveformPlayer
        ref={playerRef}
        audioUrl={recording.audio_url}
        recordingId={recording.id}
        peaks={recording.waveform_peaks}
        codec={recording.audio_codec}
        onTimeUpdate={setCurrentTime}
        markers={markers}
        onVisualizerOpen={() => setShowVisualizer(true)}
      />

      <MarkersPanel
        recordingId={recording.id}
        currentTime={currentTime}
        duration={recording.duration ?? 0}
        onSeek={handleSeek}
        onMarkersChange={setMarkers}
      />

      <AnalyzeButton
        recordingId={recording.id}
        recordingTitle={recording.title}
        audioUrl={recording.audio_url}
        onComplete={setAnalysis}
        hasExisting={analysis?.status === "completed"}
      />

      <Tabs defaultValue={analysis?.status === "completed" ? "analysis" : "chat"}>
        <TabsList>
          <TabsTrigger value="analysis" disabled={analysis?.status !== "completed"}>
            Analysis
          </TabsTrigger>
          <TabsTrigger value="chat" disabled={analysis?.status !== "completed"}>
            Chat
          </TabsTrigger>
        </TabsList>

        <TabsContent value="analysis" className="space-y-6">
          {analysis && analysis.status === "completed" && (
            <>
              <AnalysisDisplay analysis={analysis} />
              <ExportMidiButton
                notes={analysis.notes ?? []}
                filename={`${recording.title}.mid`}
              />
              <ChordTimeline
                chords={analysis.chords ?? []}
                currentTime={currentTime}
                duration={recording.duration ?? 0}
              />
              <PianoRoll
                notes={analysis.notes ?? []}
                currentTime={currentTime}
                duration={recording.duration ?? 0}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="chat">
          {analysis && analysis.status === "completed" && (
            <ChatPanel
              recordingId={recording.id}
              analysis={analysis}
              initialMessages={initialMessages}
            />
          )}
        </TabsContent>
      </Tabs>

      {showVisualizer && (
        <Visualizer
          audioElement={playerRef.current?.getAudioElement() ?? null}
          onClose={() => setShowVisualizer(false)}
        />
      )}
    </>
  );
}
