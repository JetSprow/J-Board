"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";

interface BatchActionButtonClientProps {
  value?: string;
  children: ReactNode;
  name?: string;
  destructive?: boolean;
  className?: string;
}

export function BatchActionButtonClient({
  value,
  children,
  name = "action",
  destructive,
  className,
}: BatchActionButtonClientProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      name={value == null ? undefined : name}
      value={value}
      disabled={pending}
      aria-busy={pending}
      className={cn(
        "btn-base rounded-xl border px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/20 disabled:pointer-events-none disabled:opacity-50",
        destructive ? "btn-danger-3d" : "btn-cream",
        className,
      )}
    >
      {pending ? "处理中..." : children}
    </button>
  );
}
