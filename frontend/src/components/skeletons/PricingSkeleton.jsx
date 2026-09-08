function PricingSkeleton() {
  return (
    <div className="px-4 md:px-6 lg:px-8 pt-1 pb-6 animate-pulse">
      <div className="max-w-4xl mx-auto">
        <div className="h-8 bg-[var(--om-track)] rounded w-40 mx-auto mb-2" />
        <div className="h-4 bg-[var(--om-track)] rounded w-64 mx-auto mb-8" />
        <div className="flex justify-center mb-8">
          <div className="h-12 w-64 bg-[var(--om-track)] rounded-full" />
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-[var(--om-line)] p-6">
              <div className="h-4 bg-[var(--om-track)] rounded w-16 mb-2" />
              <div className="h-8 bg-[var(--om-track)] rounded w-28 mb-1" />
              <div className="h-5 bg-[var(--om-track)] rounded w-20 mb-6" />
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((j) => (
                  <div key={j} className="flex items-center gap-2">
                    <div className="w-5 h-5 bg-[var(--om-track)] rounded-full" />
                    <div className="h-4 bg-[var(--om-track)] rounded flex-1" />
                  </div>
                ))}
              </div>
              <div className="h-12 bg-[var(--om-track)] rounded-2xl mt-6" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default PricingSkeleton;
