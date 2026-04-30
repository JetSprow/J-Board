"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteAdminLogEntry } from "@/actions/admin/logs";
import { ConfirmActionButton } from "@/components/shared/confirm-action-button";
import type { LogDeleteTarget } from "@/services/log-cleanup";

interface LogDeleteButtonProps {
  id: string;
  target: LogDeleteTarget;
  label?: string;
  title?: string;
  description?: string;
  successMessage?: string;
  className?: string;
  size?: "xs" | "sm" | "default";
}

export function LogDeleteButton({
  id,
  target,
  label = "删除",
  title = "删除这条日志？",
  description = "删除后无法恢复，只会移除这条日志记录，不会删除关联业务数据。",
  successMessage = "日志已删除",
  className = "text-destructive hover:text-destructive",
  size = "xs",
}: LogDeleteButtonProps) {
  const router = useRouter();

  return (
    <ConfirmActionButton
      size={size}
      variant="ghost"
      className={className}
      title={title}
      description={description}
      confirmLabel="删除日志"
      successMessage={successMessage}
      errorMessage="删除日志失败"
      onConfirm={() => deleteAdminLogEntry({ target, id })}
      onSuccess={() => router.refresh()}
    >
      <Trash2 className="size-3.5" />
      {label}
    </ConfirmActionButton>
  );
}
