function NotesSkeleton() {
  return (
    <div className="px-4 md:px-6 lg:px-8 pt-1 pb-6 animate-pulse">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="h-6 bg-[var(--om-track)] rounded w-24" />
          <div className="h-10 w-28 bg-[var(--om-track)] rounded-2xl" />
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="rounded-2xl border border-[var(--om-line)] p-4">
              <div className="h-5 bg-[var(--om-track)] rounded w-2/3 mb-2" />
              <div className="h-4 bg-[var(--om-track)] rounded w-full opacity-60" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default NotesSkeleton;
