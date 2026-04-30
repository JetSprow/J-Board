import { prisma } from "@/lib/prisma";
import { requireAdminApiSession } from "@/lib/admin-api";
import {
  formatAuditAction,
  formatAuditActorRole,
  formatAuditMessage,
  formatAuditTargetLabel,
  formatAuditTargetType,
} from "@/lib/audit-display";

export async function GET(req: Request) {
  const { errorResponse } = await requireAdminApiSession();
  if (errorResponse) {
    return errorResponse;
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const action = searchParams.get("action") ?? "";

  const logs = await prisma.auditLog.findMany({
    where: {
      ...(action ? { action: { startsWith: action } } : {}),
      ...(q
        ? {
            OR: [
              { action: { contains: q } },
              { targetType: { contains: q } },
              { targetLabel: { contains: q } },
              { actorEmail: { contains: q } },
              { message: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  const rows = logs.map((log) => ({
    ...log,
    actorRoleLabel: formatAuditActorRole(log.actorRole),
    actionLabel: formatAuditAction(log.action),
    targetTypeLabel: formatAuditTargetType(log.targetType),
    targetLabelDisplay: formatAuditTargetLabel(log),
    messageDisplay: formatAuditMessage(log.message),
  }));

  return new Response(JSON.stringify(rows, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="jboard-audit-logs.json"',
    },
  });
}
