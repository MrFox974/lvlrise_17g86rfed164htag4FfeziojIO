function ProductiviteSkeleton() {
  return (
    <div className="px-4 md:px-6 lg:px-8 pt-1 pb-6 max-w-2xl mx-auto animate-pulse">
      <div className="h-8 bg-[var(--om-track)] rounded w-32 mx-auto mb-2" />
      <div className="h-4 bg-[var(--om-track)] rounded w-full max-w-md mx-auto mb-8" />
      <div className="flex flex-col gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-[var(--om-line)] p-6 flex gap-4">
            <div className="w-12 h-12 bg-[var(--om-track)] rounded-[10px] flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-5 bg-[var(--om-track)] rounded w-1/2" />
              <div className="h-4 bg-[var(--om-track)] rounded w-full opacity-80" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ProductiviteSkeleton;
