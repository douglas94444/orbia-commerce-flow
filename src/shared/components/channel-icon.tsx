import { Mail, MessageCircle, Smartphone, Bell } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import {
  CHANNEL_CSS_VAR,
  normalizeChannel,
  type MessageChannel,
} from "@/shared/lib/design-tokens";

const ICONS = {
  whatsapp: MessageCircle,
  email: Mail,
  sms: Smartphone,
  push: Bell,
} as const;

export function ChannelIcon({
  channel,
  className = "size-4",
}: {
  channel: string | MessageChannel;
  className?: string;
}) {
  const normalized = typeof channel === "string" ? normalizeChannel(channel) : channel;

  if (normalized === "multicanal") {
    return (
      <span className={cn("inline-flex -space-x-1", className)}>
        <MessageCircle className="size-4" style={{ color: CHANNEL_CSS_VAR.whatsapp }} />
        <Mail className="size-4" style={{ color: CHANNEL_CSS_VAR.email }} />
      </span>
    );
  }

  const Icon = ICONS[normalized];
  return (
    <Icon
      className={className}
      style={{ color: CHANNEL_CSS_VAR[normalized] }}
      aria-hidden
    />
  );
}
