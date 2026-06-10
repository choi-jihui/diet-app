import type { ReactNode } from "react";

interface AppShellProps {
  children: ReactNode;
  footer?: ReactNode;
}

export function AppShell({ children, footer }: AppShellProps) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-gakk-cream">
      <div className="flex-1 pb-24">{children}</div>
      {footer}
    </div>
  );
}
