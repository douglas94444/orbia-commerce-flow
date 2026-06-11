import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "danger" | "neutral" | "primary" | "accent";

const tones: Record<Tone, string> = {
  success: "border-success/25 bg-success/8 text-success",
  warning: "border-warning/25 bg-warning/8 text-warning",
  danger: "border-destructive/25 bg-destructive/8 text-destructive",
  neutral: "border-border bg-muted/40 text-muted-foreground",
  primary: "border-primary/25 bg-primary/8 text-primary",
  accent: "border-primary/25 bg-primary/8 text-primary",
};

export function StatusPill({
  label,
  tone = "neutral",
  dot = false,
  className,
}: {
  label: string;
  tone?: Tone;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium",
        tones[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {label}
    </span>
  );
}

export type { Tone };
