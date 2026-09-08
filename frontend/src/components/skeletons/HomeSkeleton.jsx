function HomeSkeleton() {
  return (
    <div className="px-4 md:px-6 lg:px-8 pt-1 pb-6 max-w-4xl mx-auto animate-pulse">
      <div className="h-8 bg-[var(--om-track)] rounded w-48 mx-auto mb-2" />
      <div className="h-10 w-40 bg-[var(--om-track)] rounded-full mx-auto mb-6" />
      <div className="h-24 bg-[var(--om-track)] rounded-2xl mb-6" />
      <div className="flex flex-row gap-4">
        <div className="flex-1 min-w-[180px] h-[260px] bg-[var(--om-track)] rounded-2xl" />
        <div className="flex-1 min-w-[180px] h-[260px] bg-[var(--om-track)] rounded-2xl" />
      </div>
    </div>
  );
}

export default HomeSkeleton;
