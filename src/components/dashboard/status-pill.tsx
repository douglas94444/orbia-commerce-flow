import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "danger" | "neutral" | "primary" | "accent";

const tones: Record<Tone, string> = {
  success: "border-success/40 bg-success/10 text-success",
  warning: "border-warning/40 bg-warning/10 text-warning",
  danger: "border-destructive/40 bg-destructive/10 text-destructive",
  neutral: "border-border bg-muted/50 text-muted-foreground",
  primary: "border-primary/40 bg-primary/10 text-primary",
  accent: "border-accent/40 bg-accent/15 text-accent",
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
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
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
