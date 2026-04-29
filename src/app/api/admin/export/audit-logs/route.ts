import { prisma } from "@/lib/prisma";
import { requireAdminApiSession } from "@/lib/admin-api";

export async function GET(req: Request) {
  const { errorResponse } = await requireAdminApiSession();
  if (errorResponse) {
    return errorResponse;
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";

  const logs = await prisma.auditLog.findMany({
    where: q
      ? {
          OR: [
            { action: { contains: q } },
            { targetType: { contains: q } },
            { targetLabel: { contains: q } },
            { actorEmail: { contains: q } },
            { message: { contains: q } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  return new Response(JSON.stringify(logs, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="jboard-audit-logs.json"',
    },
  });
}
