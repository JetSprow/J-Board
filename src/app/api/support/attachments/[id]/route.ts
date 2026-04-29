import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new Response("附件访问失败：你尚未登录，请登录后重新打开附件", { status: 401 });
  }

  const { id } = await params;
  const attachment = await prisma.supportTicketAttachment.findUnique({
    where: { id },
    include: {
      ticket: {
        select: {
          userId: true,
        },
      },
    },
  });

  if (!attachment) {
    return new Response("附件访问失败：附件不存在，可能已被删除或链接不完整", { status: 404 });
  }

  if (session.user.role !== "ADMIN" && attachment.ticket.userId !== session.user.id) {
    return new Response("附件访问失败：你没有权限查看这个工单附件", { status: 403 });
  }

  const requestUrl = new URL(req.url);
  const download = requestUrl.searchParams.get("download") === "1";
  const disposition = download ? "attachment" : "inline";

  return new Response(Buffer.from(attachment.content), {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Length": String(attachment.size),
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Disposition": `${disposition}; filename=\"${encodeURIComponent(attachment.fileName)}\"`,
    },
  });
}
