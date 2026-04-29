import type { NodeServer, Prisma, Protocol } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { bytesToGb } from "@/lib/utils";
import { createPanelAdapter } from "./factory";
import type { NodePanelAdapter } from "./adapter";
import type { PanelInbound } from "./types";

export interface NodeConnectionSyncResult {
  success: boolean;
  connected: boolean;
  syncedCount: number;
  repairedClientCount?: number;
  message: string;
}

const protocolMap: Record<string, Protocol> = {
  vmess: "VMESS",
  vless: "VLESS",
  trojan: "TROJAN",
  shadowsocks: "SHADOWSOCKS",
  hysteria: "HYSTERIA2",
  hysteria2: "HYSTERIA2",
};

function normalizeProtocol(raw: string): Protocol | null {
  return protocolMap[raw.toLowerCase()] ?? null;
}

function safeJsonParse(raw: string | null | undefined): Prisma.InputJsonValue {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Prisma.InputJsonValue;
  } catch {
    return {};
  }
}

function withPanelMetadata(
  panelSettings: Prisma.InputJsonValue,
  inbound: PanelInbound,
): Prisma.InputJsonValue {
  const base =
    panelSettings && typeof panelSettings === "object" && !Array.isArray(panelSettings)
      ? (panelSettings as Record<string, unknown>)
      : {};
  const existingMeta =
    base._jboard && typeof base._jboard === "object" && !Array.isArray(base._jboard)
      ? (base._jboard as Record<string, unknown>)
      : {};

  return {
    ...base,
    _jboard: {
      ...existingMeta,
      listen: inbound.listen || null,
    },
  } as Prisma.InputJsonValue;
}

function mergeDisplayName(
  panelSettings: Prisma.InputJsonValue,
  existingSettings: unknown,
): Prisma.InputJsonValue {
  if (!existingSettings || typeof existingSettings !== "object" || Array.isArray(existingSettings)) {
    return panelSettings;
  }

  const displayName = (existingSettings as { displayName?: unknown }).displayName;
  if (typeof displayName !== "string" || !displayName.trim()) {
    return panelSettings;
  }

  const base =
    panelSettings && typeof panelSettings === "object" && !Array.isArray(panelSettings)
      ? (panelSettings as Record<string, unknown>)
      : {};

  return { ...base, displayName: displayName.trim() } as Prisma.InputJsonValue;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    const causeCode = (error as Error & { cause?: { code?: string } }).cause?.code;
    if (causeCode === "ENOTFOUND") return "无法解析面板地址，请检查域名/IP";
    if (causeCode === "ECONNREFUSED") return "连接被拒绝，请检查面板端口或防火墙";
    if (causeCode === "ETIMEDOUT") return "连接超时，请检查网络连通性";
    if (causeCode === "CERT_HAS_EXPIRED" || causeCode === "DEPTH_ZERO_SELF_SIGNED_CERT") {
      return "HTTPS 证书无效，请改用 http:// 地址或修复证书";
    }
    if (error.message) return error.message;
  }
  return "未知错误：没有收到面板或网络层返回的具体错误内容";
}

async function repairJBoardClientSubIds(
  server: NodeServer,
  adapter: NodePanelAdapter,
): Promise<number> {
  const clients = await prisma.nodeClient.findMany({
    where: {
      inbound: { serverId: server.id },
      subscription: { status: "ACTIVE" },
    },
    include: {
      subscription: { select: { id: true, endDate: true, trafficLimit: true } },
      inbound: { select: { protocol: true, panelInboundId: true } },
    },
  });

  let repaired = 0;
  for (const client of clients) {
    const panelInboundId = client.inbound.panelInboundId;
    if (panelInboundId == null) continue;

    try {
      await adapter.updateClient({
        inboundId: panelInboundId,
        email: client.email,
        uuid: client.uuid,
        subId: client.subscription.id,
        totalGB: client.subscription.trafficLimit ? bytesToGb(client.subscription.trafficLimit) : 0,
        expiryTime: client.subscription.endDate.getTime(),
        protocol: client.inbound.protocol,
        enable: client.isEnabled,
      });
      repaired += 1;
    } catch {
      continue;
    }
  }

  return repaired;
}

export async function testAndSyncNodeInbounds(
  server: NodeServer,
): Promise<NodeConnectionSyncResult> {
  const adapter = createPanelAdapter(server);

  let connected = false;
  try {
    connected = await adapter.login();
  } catch (error) {
    return {
      success: false,
      connected: false,
      syncedCount: 0,
      message: `连接失败：${errorMessage(error)}`,
    };
  }

  if (!connected) {
    return {
      success: false,
      connected: false,
      syncedCount: 0,
      message: "连接失败：登录被拒绝，请检查面板地址和账号密码",
    };
  }

  try {
    const panelInbounds = await adapter.getInbounds();
    let syncedCount = 0;

    for (const inbound of panelInbounds) {
      const protocol = normalizeProtocol(inbound.protocol);
      if (!protocol) continue;

      const tag = inbound.tag || inbound.remark || `inbound-${inbound.id}`;
      const settings = withPanelMetadata(safeJsonParse(inbound.settings), inbound);
      const streamSettings = safeJsonParse(inbound.streamSettings);

      const existing = await prisma.nodeInbound.findFirst({
        where: {
          serverId: server.id,
          panelInboundId: inbound.id,
        },
        select: { id: true, settings: true },
      });

      if (existing) {
        await prisma.nodeInbound.update({
          where: { id: existing.id },
          data: {
            protocol,
            port: inbound.port,
            tag,
            settings: mergeDisplayName(settings, existing.settings),
            streamSettings,
            isActive: true,
          },
        });
      } else {
        await prisma.nodeInbound.create({
          data: {
            serverId: server.id,
            panelInboundId: inbound.id,
            protocol,
            port: inbound.port,
            tag,
            settings,
            streamSettings,
            isActive: true,
          },
        });
      }

      syncedCount += 1;
    }

    const repairedClientCount = await repairJBoardClientSubIds(server, adapter);
    const repairMessage = repairedClientCount > 0 ? `，已修复 ${repairedClientCount} 个客户端订阅标识` : "";

    return {
      success: true,
      connected: true,
      syncedCount,
      repairedClientCount,
      message: `连接成功，已同步 ${syncedCount} 个入站${repairMessage}`,
    };
  } catch (error) {
    return {
      success: false,
      connected: true,
      syncedCount: 0,
      message: `连接成功但同步入站失败：${errorMessage(error)}`,
    };
  }
}
