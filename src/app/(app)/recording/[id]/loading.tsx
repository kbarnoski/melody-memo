export default function RecordingLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Title area */}
      <div>
        <div className="h-8 w-64 rounded bg-muted" />
        <div className="mt-2 h-4 w-48 rounded bg-muted" />
      </div>

      {/* Waveform player area */}
      <div className="space-y-3">
        <div className="h-[104px] rounded-lg border bg-card" />
        <div className="flex items-center justify-between">
          <div className="h-4 w-10 rounded bg-muted" />
          <div className="flex gap-2">
            <div className="h-9 w-9 rounded bg-muted" />
            <div className="h-9 w-9 rounded bg-muted" />
            <div className="h-9 w-9 rounded bg-muted" />
          </div>
          <div className="h-4 w-10 rounded bg-muted" />
        </div>
      </div>

      {/* Tabs area */}
      <div className="space-y-4">
        <div className="flex gap-4 border-b pb-2">
          <div className="h-5 w-20 rounded bg-muted" />
          <div className="h-5 w-16 rounded bg-muted" />
        </div>
        <div className="space-y-3">
          <div className="h-4 w-full rounded bg-muted" />
          <div className="h-4 w-3/4 rounded bg-muted" />
          <div className="h-4 w-5/6 rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}
