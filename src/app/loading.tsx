export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col items-center gap-3 text-sm text-muted-foreground"
      >
        <span
          className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground"
          aria-hidden="true"
        />
        <span>読み込み中...</span>
      </div>
    </div>
  );
}
