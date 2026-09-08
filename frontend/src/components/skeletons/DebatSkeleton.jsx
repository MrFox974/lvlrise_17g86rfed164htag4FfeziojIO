function DebatSkeleton() {
  return (
    <div className="px-4 md:px-6 lg:px-8 pt-1 pb-6 animate-pulse">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="h-6 bg-[var(--om-track)] rounded w-24" />
          <div className="h-10 w-28 bg-[var(--om-track)] rounded-2xl" />
        </div>
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-2xl border border-[var(--om-line)] p-4">
              <div className="h-5 bg-[var(--om-track)] rounded w-2/3 mb-2" />
              <div className="h-4 bg-[var(--om-track)] rounded w-full opacity-60 mb-3" />
              <div className="h-1.5 bg-[var(--om-track)] rounded-full w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default DebatSkeleton;
