export default function PathLoading() {
  return (
    <div
      className="min-h-dvh w-full"
      style={{ backgroundColor: "#000", color: "#fff" }}
    >
      <div className="mx-auto max-w-2xl px-6 pt-6">
        {/* Skeleton top bar — match page layout so nothing shifts on reveal */}
        <div className="h-4" />
      </div>
      <div className="mx-auto max-w-2xl px-6 pt-10 pb-24">
        <div className="mb-12 text-center">
          <div
            className="mx-auto h-3 w-24 rounded-sm mb-3"
            style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
          />
          <div
            className="mx-auto h-14 w-72 rounded-md mb-3"
            style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
          />
          <div
            className="mx-auto h-4 w-48 rounded-sm"
            style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
          />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl px-5 py-4"
              style={{
                border: "1px solid rgba(255,255,255,0.04)",
                backgroundColor: "rgba(255,255,255,0.01)",
              }}
            >
              <div className="flex items-start gap-4">
                <div className="h-4 w-6" style={{ backgroundColor: "rgba(255,255,255,0.04)" }} />
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-48 rounded-sm" style={{ backgroundColor: "rgba(255,255,255,0.05)" }} />
                  <div className="h-3 w-36 rounded-sm" style={{ backgroundColor: "rgba(255,255,255,0.03)" }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
