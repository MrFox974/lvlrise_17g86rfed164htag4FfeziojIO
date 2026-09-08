function MarkdownSkeleton() {
  return (
    <div className="px-4 md:px-6 lg:px-8 pt-1 pb-6 max-w-2xl mx-auto animate-pulse">
      <div className="flex items-center gap-2 mb-6">
        <div className="h-4 bg-[var(--om-track)] rounded w-28" />
      </div>
      <div className="h-8 bg-[var(--om-track)] rounded w-32 mb-2" />
      <div className="h-4 bg-[var(--om-track)] rounded w-full max-w-md mb-8" />
      <div className="flex justify-end mb-4">
        <div className="h-10 w-36 bg-[var(--om-track)] rounded-2xl" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-[var(--om-line)] p-4">
            <div className="flex justify-between items-start mb-2">
              <div className="h-5 bg-[var(--om-track)] rounded w-40" />
              <div className="w-5 h-5 bg-[var(--om-track)] rounded" />
            </div>
            <div className="h-4 bg-[var(--om-track)] rounded w-3/4 opacity-60" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default MarkdownSkeleton;
