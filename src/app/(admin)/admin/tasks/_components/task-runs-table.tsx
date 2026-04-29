import { batchRetryTaskRuns, retryTaskRun } from "@/actions/admin/tasks";
import { BatchActionBar, BatchActionButton } from "@/components/admin/batch-action-bar";
import { DataTableShell } from "@/components/admin/data-table-shell";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeadCell,
  DataTableHeaderRow,
  DataTableRow,
} from "@/components/shared/data-table";
import { TaskStatusBadge, taskKindLabels } from "@/components/shared/domain-badges";
import { PendingSubmitButton } from "@/components/shared/pending-submit-button";
import { formatDate } from "@/lib/utils";
import type { AdminTaskRunRow } from "../tasks-data";

interface TaskRunsTableProps {
  tasks: AdminTaskRunRow[];
}

export function TaskRunsTable({ tasks }: TaskRunsTableProps) {
  return (
    <DataTableShell
      isEmpty={tasks.length === 0}
      emptyTitle="暂无任务记录"
      emptyDescription="手动或定时任务执行后，会显示运行状态与错误信息。"
      toolbar={
        <BatchActionBar
          id="task-batch-form"
          action={batchRetryTaskRuns}
          label="批量重试失败任务"
          className="rounded-none bg-transparent"
        >
          <BatchActionButton>批量重试失败任务</BatchActionButton>
        </BatchActionBar>
      }
    >
      <DataTable aria-label="任务运行列表" className="min-w-[980px]">
        <DataTableHead>
          <DataTableHeaderRow>
            <DataTableHeadCell>选择</DataTableHeadCell>
            <DataTableHeadCell>时间</DataTableHeadCell>
            <DataTableHeadCell>任务</DataTableHeadCell>
            <DataTableHeadCell>状态</DataTableHeadCell>
            <DataTableHeadCell>操作者</DataTableHeadCell>
            <DataTableHeadCell>错误</DataTableHeadCell>
            <DataTableHeadCell className="text-right">操作</DataTableHeadCell>
          </DataTableHeaderRow>
        </DataTableHead>
        <DataTableBody>
          {tasks.map((task) => (
            <DataTableRow key={task.id}>
              <DataTableCell>
                {task.retryable && task.status === "FAILED" ? (
                  <input
                    form="task-batch-form"
                    type="checkbox"
                    name="taskIds"
                    value={task.id}
                    aria-label={`选择任务 ${task.title}`}
                  />
                ) : null}
              </DataTableCell>
              <DataTableCell className="whitespace-nowrap text-muted-foreground">
                {formatDate(task.createdAt)}
              </DataTableCell>
              <DataTableCell>
                <p className="font-medium">{task.title}</p>
                <p className="text-xs text-muted-foreground">{taskKindLabels[task.kind]}</p>
              </DataTableCell>
              <DataTableCell>
                <TaskStatusBadge status={task.status} />
              </DataTableCell>
              <DataTableCell>{task.triggeredBy?.email ?? "系统"}</DataTableCell>
              <DataTableCell className="max-w-lg whitespace-pre-wrap break-words text-xs text-muted-foreground">
                {task.errorMessage || "—"}
              </DataTableCell>
              <DataTableCell>
                <div className="flex justify-end">
                  {task.retryable && task.status === "FAILED" && (
                    <form
                      action={async () => {
                        "use server";
                        await retryTaskRun(task.id);
                      }}
                    >
                      <PendingSubmitButton size="sm" variant="outline" pendingLabel="重试中...">重试</PendingSubmitButton>
                    </form>
                  )}
                </div>
              </DataTableCell>
            </DataTableRow>
          ))}
        </DataTableBody>
      </DataTable>
    </DataTableShell>
  );
}
