"use client";

import { useState } from "react";
import { KeyRound, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmActionButton } from "@/components/shared/confirm-action-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteNode, generateAgentToken, revokeAgentToken, testNodeConnection } from "@/actions/admin/nodes";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "sonner";

interface NodeActionValue {
  id: string;
  name: string;
  agentToken: string | null;
}

const INSTALL_SCRIPT_URL = "https://raw.githubusercontent.com/JetSprow/J-Board/main/scripts/install-jboard-agent.sh";

function shellQuote(value: string) {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function getServerUrl() {
  if (typeof window === "undefined") return "";
  const { protocol, host, hostname } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") return "";
  return `${protocol}//${host}`;
}

function buildInstallCommand(token: string, siteUrl: string | null) {
  const serverUrl = siteUrl || getServerUrl() || "https://你的域名";
  return `curl -fsSL ${INSTALL_SCRIPT_URL} | SERVER_URL=${shellQuote(serverUrl)} AUTH_TOKEN=${shellQuote(token)} bash`;
}

export function NodeActions({ node, siteUrl }: { node: NodeActionValue; siteUrl: string | null }) {
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [plainToken, setPlainToken] = useState("");
  const [installCommand, setInstallCommand] = useState("");
  const hasToken = !!node.agentToken;

  async function handleGenerateToken() {
    try {
      const token = await generateAgentToken(node.id);
      setPlainToken(token);
      setInstallCommand(buildInstallCommand(token, siteUrl));
      setTokenDialogOpen(true);
    } catch (error) {
      toast.error(getErrorMessage(error, "生成 Token 失败"));
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>...</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem
            onClick={async () => {
              try {
                const res = await testNodeConnection(node.id);
                if (res.success) toast.success(res.message);
                else toast.error(getErrorMessage(res.message, "节点测试失败"));
              } catch (error) {
                toast.error(getErrorMessage(error, "测试失败"));
              }
            }}
          >
            测试并同步入站
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleGenerateToken}>
            {hasToken ? "重新生成探测 Token" : "生成探测 Token"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {hasToken && (
        <ConfirmActionButton
          size="sm"
          variant="outline"
          title="撤销这个探测 Token？"
          description="撤销后，延迟和线路探测程序将无法继续上报数据。"
          confirmLabel="撤销 Token"
          successMessage="探测 Token 已撤销"
          errorMessage="撤销失败"
          onConfirm={() => revokeAgentToken(node.id)}
        >
          撤销 Token
        </ConfirmActionButton>
      )}

      <ConfirmActionButton
        size="sm"
        variant="destructive"
        title="删除这个节点？"
        description="节点、线路入口和相关探测数据会被清理。请确认没有套餐仍依赖它。"
        confirmLabel="删除节点"
        successMessage="节点已删除"
        errorMessage="删除失败"
        onConfirm={() => deleteNode(node.id)}
      >
        删除
      </ConfirmActionButton>

      <Dialog open={tokenDialogOpen} onOpenChange={setTokenDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-xs font-semibold tracking-[0.14em] text-primary">
              <KeyRound className="size-3.5" /> PROBE TOKEN
            </div>
            <DialogTitle>探测 Token — {node.name}</DialogTitle>
            <DialogDescription>请立即复制 Token 或一键安装命令，关闭后将无法再次查看。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="text-xs font-semibold text-muted-foreground">探测 Token</div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <code className="block w-full select-all break-all font-mono text-xs text-foreground">
                  {plainToken}
                </code>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(plainToken);
                  toast.success("Token 已复制");
                }}
              >
                复制 Token
              </Button>
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <Terminal className="size-3.5" /> 一键安装探测 Agent
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <code className="block w-full select-all break-all font-mono text-xs text-foreground">
                  {installCommand}
                </code>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(installCommand);
                  toast.success("安装命令已复制");
                }}
              >
                复制一键安装命令
              </Button>
            </div>

            {!siteUrl && (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-700 dark:text-amber-200">
                建议先到系统设置填写站点域名，否则从本地地址打开后台时命令会带本机地址。
              </p>
            )}
            <p className="text-xs leading-5 text-muted-foreground">
              此 Agent 仅用于 `/api/agent/latency` 和 `/api/agent/trace` 探测上报；节点客户端开通已改由 3x-ui 面板 API 处理。
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
