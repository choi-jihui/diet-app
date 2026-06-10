export function FullScreenLoading({ message = "불러오는 중..." }: { message?: string }) {
  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-gakk-cream px-6">
      <p className="text-sm text-gakk-text-muted">{message}</p>
    </div>
  );
}

export function FullScreenError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex min-h-dvh w-full flex-col items-center justify-center gap-4 bg-gakk-cream px-6 text-center">
      <p className="text-sm text-gakk-text-muted">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-2xl bg-gakk-mint px-5 py-2.5 text-sm font-semibold text-white"
        >
          다시 시도
        </button>
      ) : null}
    </div>
  );
}
