export default function CreateLoading() {
  return (
    <div className="mx-auto w-full max-w-xl pb-16 animate-pulse">
      <div className="h-4 w-12 rounded-sm bg-white/[0.04] mb-6" />
      <div className="h-8 w-56 rounded-md bg-white/[0.06] mb-2" />
      <div className="h-3 w-40 rounded-sm bg-white/[0.04] mb-8" />
      <div className="space-y-5">
        <div className="h-10 rounded-xl bg-white/[0.03] border border-white/[0.04]" />
        <div className="h-24 rounded-xl bg-white/[0.03] border border-white/[0.04]" />
        <div className="h-32 rounded-xl bg-white/[0.03] border border-white/[0.04]" />
        <div className="h-12 rounded-xl bg-white/[0.03] border border-white/[0.04]" />
      </div>
    </div>
  );
}
