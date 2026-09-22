"use client";

import type { WorkPlatform } from "@/lib/types";
import { Button } from "@/components/ui/button";

export function PlatformChip({
  platform,
}: {
  platform: WorkPlatform | null | undefined;
}) {
  if (!platform) {
    return (
      <span className="status-morph inline-flex items-center rounded-md border border-border/60 px-2 py-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        —
      </span>
    );
  }
  return (
    <span
      className={`status-morph inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${
        platform === "cursor" ? "chip-cyan" : "chip-claude"
      }`}
    >
      {platform === "cursor" ? "Cursor" : "Claude"}
    </span>
  );
}

export function PlatformPicker({
  value,
  disabled,
  onChange,
}: {
  value: WorkPlatform | null | undefined;
  disabled?: boolean;
  onChange: (next: WorkPlatform | null) => void;
}) {
  const current = value ?? null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
        Work on
      </span>
      {(
        [
          ["cursor", "Cursor"],
          ["claude", "Claude"],
          [null, "—"],
        ] as const
      ).map(([key, label]) => {
        const active = current === key;
        return (
          <Button
            key={label}
            type="button"
            size="xs"
            disabled={disabled}
            variant={active ? "default" : "outline"}
            className={
              active && key === "claude"
                ? "border-warning/40 bg-warning/20 text-warning hover:bg-warning/30"
                : undefined
            }
            onClick={() => onChange(key)}
          >
            {label}
          </Button>
        );
      })}
    </div>
  );
}
