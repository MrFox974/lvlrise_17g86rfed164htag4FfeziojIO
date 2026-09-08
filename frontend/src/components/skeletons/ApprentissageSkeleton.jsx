function ApprentissageSkeleton() {
  return (
    <div className="px-4 md:px-6 lg:px-8 pt-1 pb-6 animate-pulse">
      <div className="flex gap-2 mb-6 justify-center">
        <div className="h-10 w-24 bg-[var(--om-track)] rounded-full" />
        <div className="h-10 w-24 bg-[var(--om-track)] rounded-full" />
      </div>
      <div className="flex flex-col md:flex-row md:gap-6">
        <div className="flex-1 min-w-0">
          <div className="rounded-2xl bg-[var(--om-track)]/50 border border-[var(--om-line)] p-6 md:p-8">
            <div className="h-6 bg-[var(--om-track)] rounded w-40 mx-auto mb-8" />
            <div className="flex justify-center gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex flex-col items-center gap-2">
                  <div className="w-12 h-40 bg-[var(--om-track)] rounded-full" />
                  <div className="w-8 h-8 bg-[var(--om-track)] rounded-full" />
                  <div className="h-4 bg-[var(--om-track)] rounded w-10" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex-[0_0_auto] md:min-w-[280px] mt-4 md:mt-0">
          <div className="rounded-2xl bg-[var(--om-track)]/50 border border-[var(--om-line)] p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="w-8 h-8 bg-[var(--om-track)] rounded-full" />
              <div className="h-4 bg-[var(--om-track)] rounded w-28" />
              <div className="w-8 h-8 bg-[var(--om-track)] rounded-full" />
            </div>
            <div className="grid grid-cols-7 gap-1">
              {[...Array(35)].map((_, i) => (
                <div key={i} className="h-10 bg-[var(--om-track)] rounded-2xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ApprentissageSkeleton;
