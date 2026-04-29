import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";

/**
 * Authenticate an incoming Agent request by Bearer token.
 * Returns the matched nodeId, or a 401 NextResponse on failure.
 */
export async function authenticateAgent(
  req: Request,
): Promise<{ nodeId: string } | NextResponse> {
  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "认证失败：请求头缺少 Bearer Token" }, { status: 401 });
  }
  const token = authHeader.slice(7);

  const nodes = await prisma.nodeServer.findMany({
    where: { agentToken: { not: null } },
    select: { id: true, agentToken: true },
  });

  const tokenBuf = Buffer.from(token);

  for (const node of nodes) {
    try {
      const decrypted = decrypt(node.agentToken!);
      const expectedBuf = Buffer.from(decrypted);
      if (
        tokenBuf.length === expectedBuf.length &&
        timingSafeEqual(tokenBuf, expectedBuf)
      ) {
        return { nodeId: node.id };
      }
    } catch {
      // Skip nodes with corrupt tokens
    }
  }

  return NextResponse.json({ error: "认证失败：Token 无效、已撤销或节点未配置探测 Token" }, { status: 401 });
}

/** Type guard: true when authenticateAgent returned an error response */
export function isAuthError(
  result: { nodeId: string } | NextResponse,
): result is NextResponse {
  return result instanceof NextResponse;
}
