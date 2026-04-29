"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import type { ComponentProps, ReactNode } from "react";

type PendingSubmitButtonProps = ComponentProps<typeof Button> & {
  children: ReactNode;
  pendingLabel?: ReactNode;
};

export function PendingSubmitButton({
  children,
  disabled,
  pendingLabel = "处理中...",
  type = "submit",
  ...props
}: PendingSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button type={type} disabled={disabled || pending} aria-busy={pending} {...props}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
