import Link from "next/link";

interface QuickLinkCardProps {
  href: string;
  title: string;
  description: string;
  variant?: "default" | "primary";
}

export function QuickLinkCard({
  href,
  title,
  description,
  variant = "default",
}: QuickLinkCardProps) {
  const isPrimary = variant === "primary";

  return (
    <Link
      href={href}
      className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3.5 transition-colors active:opacity-80 ${
        isPrimary
          ? "border border-gakk-mint/30 bg-gakk-primary-soft"
          : "border border-gakk-line bg-white"
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className={`font-semibold ${isPrimary ? "text-gakk-mint" : "text-gakk-text"}`}>
          {title}
        </p>
        <p className="mt-0.5 text-sm text-gakk-text-muted">{description}</p>
      </div>
      <span className={`shrink-0 text-sm ${isPrimary ? "text-gakk-mint" : "text-gakk-text-muted"}`}>
        →
      </span>
    </Link>
  );
}
