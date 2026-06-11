import { cn } from "@/shared/lib/utils";
import {
  RFM_SEGMENT_LABELS,
  RFM_SEGMENT_STYLES,
  normalizeRfmSegment,
  type RfmSegmentKey,
} from "@/shared/lib/design-tokens";

export function RFMBadge({
  segment,
  label,
  className,
}: {
  segment: string | RfmSegmentKey;
  label?: string;
  className?: string;
}) {
  const key = typeof segment === "string" ? normalizeRfmSegment(segment) : segment;
  const display = label ?? RFM_SEGMENT_LABELS[key];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        RFM_SEGMENT_STYLES[key],
        className,
      )}
    >
      {display}
    </span>
  );
}
