function DomainesSkeleton() {
  return (
    <div className="px-4 md:px-6 lg:px-8 pt-1 pb-6 max-w-2xl mx-auto animate-pulse">
      <div className="h-8 bg-[var(--om-track)] rounded w-56 mx-auto mb-2" />
      <div className="h-4 bg-[var(--om-track)] rounded w-full max-w-md mx-auto mb-8" />
      <div className="flex justify-center mb-8">
        <div className="h-10 w-48 bg-[var(--om-track)] rounded-full" />
      </div>
      <div className="rounded-2xl border border-dashed border-[var(--om-line)] bg-[var(--om-track)]/30 p-5 mb-6">
        <div className="h-10 bg-[var(--om-track)] rounded w-40 mx-auto" />
      </div>
      <div className="space-y-6">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-[var(--om-line)] bg-[var(--om-surface)] p-5">
            <div className="flex justify-between mb-3">
              <div className="h-6 bg-[var(--om-track)] rounded w-32" />
              <div className="flex gap-2">
                <div className="w-9 h-9 bg-[var(--om-track)] rounded-[10px]" />
                <div className="w-9 h-9 bg-[var(--om-track)] rounded-[10px]" />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-2">
              {[1, 2, 3, 4].map((j) => (
                <div key={j} className="h-12 bg-[var(--om-track)] rounded-2xl" />
              ))}
            </div>
            <div className="h-3 bg-[var(--om-track)] rounded w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default DomainesSkeleton;
