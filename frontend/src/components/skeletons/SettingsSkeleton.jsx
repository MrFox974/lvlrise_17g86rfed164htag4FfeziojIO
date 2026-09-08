function SettingsSkeleton() {
  return (
    <div className="px-4 md:px-6 lg:px-8 pt-1 pb-6 max-w-lg mx-auto animate-pulse">
      <div className="h-8 bg-[var(--om-track)] rounded w-32 mx-auto mb-2" />
      <div className="h-4 bg-[var(--om-track)] rounded w-64 mx-auto mb-8" />
      <div className="rounded-2xl border border-[var(--om-line)] p-6">
        <div className="h-6 bg-[var(--om-track)] rounded w-48 mb-4" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i}>
              <div className="h-4 bg-[var(--om-track)] rounded w-36 mb-2" />
              <div className="h-10 bg-[var(--om-track)] rounded-[10px]" />
            </div>
          ))}
        </div>
        <div className="h-10 bg-[var(--om-track)] rounded-[10px] w-40 mt-6" />
      </div>
    </div>
  );
}

export default SettingsSkeleton;
