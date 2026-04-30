"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";

interface BooleanToggleProps {
  id?: string;
  name?: string;
  value?: boolean;
  defaultValue?: boolean;
  onChange?: (value: boolean) => void;
  trueLabel?: string;
  falseLabel?: string;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
}

export function BooleanToggle({
  id,
  name,
  value,
  defaultValue = false,
  onChange,
  trueLabel = "开启",
  falseLabel = "关闭",
  ariaLabel,
  className,
  disabled = false,
}: BooleanToggleProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const controlled = value != null;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const currentValue = controlled ? value : internalValue;

  function select(nextValue: boolean) {
    if (disabled) return;
    if (!controlled) setInternalValue(nextValue);
    onChange?.(nextValue);
  }

  return (
    <div className={cn("w-full", className)}>
      {name && <input id={inputId} type="hidden" name={name} value={String(currentValue)} />}
      <div
        role="group"
        aria-label={ariaLabel}
        className="inline-flex min-h-10 w-full rounded-lg border border-border bg-muted/25 p-1"
      >
        {[
          { value: true, label: trueLabel },
          { value: false, label: falseLabel },
        ].map((option) => {
          const active = currentValue === option.value;
          return (
            <button
              key={String(option.value)}
              type="button"
              aria-pressed={active}
              disabled={disabled}
              onClick={() => select(option.value)}
              className={cn(
                "min-w-0 flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/55 hover:text-foreground",
              )}
            >
              <span className="truncate">{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
