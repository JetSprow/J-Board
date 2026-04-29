"use client";

import { useRef, useState, type ComponentProps, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getErrorMessage } from "@/lib/errors";

type ButtonProps = ComponentProps<typeof Button>;

interface ConfirmActionButtonProps {
  children: ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  successMessage?: string;
  errorMessage?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
  disabled?: boolean;
  onConfirm: () => void | Promise<void>;
  onSuccess?: () => void;
}

export function ConfirmActionButton({
  children,
  title,
  description,
  confirmLabel,
  cancelLabel = "先不处理",
  successMessage,
  errorMessage = "操作失败",
  variant = "outline",
  size = "default",
  className,
  disabled,
  onConfirm,
  onSuccess,
}: ConfirmActionButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);

  async function runAction() {
    if (loadingRef.current) return;

    loadingRef.current = true;
    setLoading(true);
    try {
      await onConfirm();
      if (successMessage) toast.success(successMessage);
      setOpen(false);
      onSuccess?.();
    } catch (error) {
      toast.error(getErrorMessage(error, errorMessage));
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        disabled={disabled || loading}
        onClick={() => setOpen(true)}
      >
        {children}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="mb-1 flex size-9 items-center justify-center rounded-lg border border-destructive/15 bg-destructive/10 text-destructive">
              <AlertTriangle className="size-5" />
            </div>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              {cancelLabel}
            </Button>
            <Button type="button" variant="destructive" onClick={() => void runAction()} disabled={loading}>
              {loading ? "处理中..." : confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
