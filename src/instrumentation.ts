export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const [{ startTrafficSyncScheduler }, { startLogCleanupScheduler }] = await Promise.all([
      import("./services/traffic-sync-scheduler"),
      import("./services/log-cleanup-scheduler"),
    ]);
    startTrafficSyncScheduler();
    startLogCleanupScheduler();
  }
}
