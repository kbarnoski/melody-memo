"use client";

import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

const TAG_COLORS: Record<string, string> = {
  red: "bg-primary/10 text-primary",
  blue: "bg-primary/10 text-primary",
  green: "bg-primary/10 text-primary",
  purple: "bg-primary/10 text-primary",
  orange: "bg-primary/15 text-primary",
  pink: "bg-primary/15 text-primary",
  cyan: "bg-primary/15 text-primary",
  yellow: "bg-primary/15 text-primary",
};

const DEFAULT_COLOR = "bg-primary/10 text-primary";

interface TagBadgeProps {
  name: string;
  color?: string;
  onRemove?: () => void;
}

export function TagBadge({ name, color, onRemove }: TagBadgeProps) {
  const colorClass = color && TAG_COLORS[color] ? TAG_COLORS[color] : DEFAULT_COLOR;

  return (
    <Badge variant="secondary" className={`gap-1 ${colorClass}`}>
      {name}
      {onRemove && (
        <button onClick={onRemove} className="ml-0.5 hover:opacity-70">
          <X className="h-3 w-3" />
        </button>
      )}
    </Badge>
  );
}

export { TAG_COLORS };
