export function Loading({ rows = 4 }: { rows?: number }) {
  return (
    <div className="loading-stack">
      {Array.from({ length: rows }).map((_, index) => (
        <div className="skeleton" key={index} />
      ))}
    </div>
  );
}
