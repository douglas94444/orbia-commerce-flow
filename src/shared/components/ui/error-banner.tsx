import { AlertTriangle } from "lucide-react";
import { cn } from "@/shared/lib/utils";

interface ErrorBannerProps {
  message?: string;
  className?: string;
}

export function ErrorBanner({ message, className }: ErrorBannerProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/[0.07] px-4 py-3 text-sm text-destructive",
        className,
      )}
    >
      <AlertTriangle className="size-4 shrink-0" />
      <span>{message ?? "Erro ao carregar dados. Tente novamente."}</span>
    </div>
  );
}
