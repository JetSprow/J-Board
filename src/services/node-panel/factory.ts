import type { NodeServer } from "@prisma/client";
import type { NodePanelAdapter } from "./adapter";
import { ThreeXUIAdapter } from "./three-x-ui";

export function createPanelAdapter(server: NodeServer): NodePanelAdapter {
  const panelType = server.panelType ?? "3x-ui";
  if (panelType !== "3x-ui") {
    throw new Error(`节点 ${server.name} 面板类型不支持：${panelType}，当前仅支持 3x-ui`);
  }
  if (!server.panelUrl || !server.panelUsername || !server.panelPassword) {
    throw new Error(`节点 ${server.name} 未配置 3x-ui 面板信息`);
  }
  return new ThreeXUIAdapter(server.panelUrl, server.panelUsername, server.panelPassword);
}
