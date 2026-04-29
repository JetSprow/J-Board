import type { ReactNode } from "react";
import { BatchActionButtonClient } from "@/components/admin/batch-action-button-client";
import { cn } from "@/lib/utils";

interface BatchActionBarProps {
  action: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
  id?: string;
  label?: string;
  className?: string;
}

interface BatchActionButtonProps {
  value?: string;
  children: ReactNode;
  name?: string;
  destructive?: boolean;
  className?: string;
}

export function BatchActionBar({
  action,
  children,
  id,
  label = "批量操作",
  className,
}: BatchActionBarProps) {
  return (
    <form
      id={id}
      action={action}
      aria-label={label}
      className={cn("flex flex-wrap gap-2 rounded-lg bg-muted/25 p-3", className)}
    >
      {children}
    </form>
  );
}

export function BatchActionButton(props: BatchActionButtonProps) {
  return <BatchActionButtonClient {...props} />;
}
