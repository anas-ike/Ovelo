export function Loading({ rows = 4 }: { rows?: number }) {
  return (
    <div className="loading-stack" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, index) => (
        <div className="skeleton" key={index} aria-hidden="true" />
      ))}
    </div>
  );
}
