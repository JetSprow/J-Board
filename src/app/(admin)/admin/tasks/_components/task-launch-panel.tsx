import { BellRing } from "lucide-react";
import { runReminderTask } from "@/actions/admin/tasks";
import { PendingSubmitButton } from "@/components/shared/pending-submit-button";

export function TaskLaunchPanel() {
  return (
    <div className="form-panel grid gap-3 md:grid-cols-3">
      <form action={runReminderTask} className="choice-card flex flex-col items-start gap-3 p-4">
        <span className="flex size-10 items-center justify-center rounded-[1rem] bg-amber-500/10 text-amber-700 dark:text-amber-300">
          <BellRing className="size-4" />
        </span>
        <div>
          <p className="font-semibold">提醒派发</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">检查即将到期订阅并生成提醒。</p>
        </div>
        <PendingSubmitButton size="sm" variant="outline" className="mt-auto w-full" pendingLabel="派发中...">派发提醒</PendingSubmitButton>
      </form>
    </div>
  );
}
