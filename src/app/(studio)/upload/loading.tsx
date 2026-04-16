export default function UploadLoading() {
  return (
    <div className="mx-auto max-w-2xl animate-pulse">
      <div className="h-7 w-48 rounded-md bg-white/[0.06] mb-2" />
      <div className="h-4 w-72 rounded-sm bg-white/[0.04] mb-8" />
      <div className="h-40 rounded-xl bg-white/[0.03] border border-white/[0.04]" />
    </div>
  );
}
