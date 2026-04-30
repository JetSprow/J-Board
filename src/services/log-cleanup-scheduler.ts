import { prisma } from "@/lib/prisma";
import { getAppConfig } from "@/services/app-config";
import { cleanupExpiredLogs, cutoffFromDays, normalizeRetentionDays, summarizeLogCleanup } from "@/services/log-cleanup";

const DEFAULT_INTERVAL_SECONDS = 6 * 60 * 60;
const MIN_RUN_GAP_MS = 23 * 60 * 60 * 1000;

const globalForLogCleanup = globalThis as typeof globalThis & {
  __jboardLogCleanupScheduler?: LogCleanupSchedulerState;
};

type Timer = ReturnType<typeof setTimeout>;

interface LogCleanupSchedulerState {
  started: boolean;
  running: boolean;
  timer: Timer | null;
}

function getState() {
  if (!globalForLogCleanup.__jboardLogCleanupScheduler) {
    globalForLogCleanup.__jboardLogCleanupScheduler = {
      started: false,
      running: false,
      timer: null,
    };
  }
  return globalForLogCleanup.__jboardLogCleanupScheduler;
}

function unrefTimer(timer: Timer) {
  if (typeof timer === "object" && timer && "unref" in timer && typeof timer.unref === "function") {
    timer.unref();
  }
}

function scheduleNext(state: LogCleanupSchedulerState, intervalSeconds = DEFAULT_INTERVAL_SECONDS) {
  state.timer = setTimeout(() => {
    void runLogCleanupCycle(state);
  }, intervalSeconds * 1000);
  unrefTimer(state.timer);
}

async function runLogCleanupCycle(state: LogCleanupSchedulerState) {
  try {
    if (state.running) return;
    state.running = true;

    const config = await getAppConfig();

    if (!config?.logCleanupEnabled) return;
    if (config.logCleanupLastRunAt && Date.now() - config.logCleanupLastRunAt.getTime() < MIN_RUN_GAP_MS) {
      return;
    }

    const retentionDays = normalizeRetentionDays(config.logRetentionDays);
    const summary = await cleanupExpiredLogs({
      target: "ALL",
      cutoff: cutoffFromDays(retentionDays),
      keepActiveRiskRestrictions: true,
    });

    await prisma.appConfig.update({
      where: { id: "default" },
      data: { logCleanupLastRunAt: new Date() },
    });

    const cleaned = Object.values(summary).some((count) => count > 0);
    if (cleaned) {
      console.info(`J-Board log cleanup finished: ${summarizeLogCleanup(summary)}`);
    }
  } catch (error) {
    console.error("J-Board log cleanup scheduler failed", error);
  } finally {
    state.running = false;
    scheduleNext(state);
  }
}

export function startLogCleanupScheduler() {
  if (process.env.JBOARD_LOG_CLEANUP_SCHEDULER === "false") return;

  const state = getState();
  if (state.started) return;

  state.started = true;
  scheduleNext(state, 60);
}
