export default function LibraryLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header with search */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-32 rounded bg-muted" />
        <div className="h-9 w-24 rounded bg-muted" />
      </div>
      <div className="h-10 w-full rounded-md bg-muted" />

      {/* Recording cards */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 rounded-xl border bg-card px-6 py-4"
          >
            <div className="h-10 w-10 shrink-0 rounded-lg bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-48 rounded bg-muted" />
              <div className="h-3 w-32 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
