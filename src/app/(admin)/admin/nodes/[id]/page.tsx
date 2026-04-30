import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { StatusBadge } from "@/components/shared/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { getNodeStatusLabel } from "@/lib/domain-labels";
import { getNodeDetail } from "./node-detail-data";
import { NodeDetailTabs } from "./_components/node-detail-tabs";

export const metadata: Metadata = {
  title: "节点详情",
};

export default async function NodeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const node = await getNodeDetail(id);

  return (
    <PageShell>
      <div className="flex items-center gap-2">
        <Link
          href="/admin/nodes"
          className={buttonVariants({ variant: "ghost", size: "icon" })}
        >
          <ArrowLeft className="size-4" />
        </Link>
        <PageHeader
          eyebrow="基础设施"
          title={node.name}
          description={`3x-ui · ${node.panelUrl || "未配置面板"}`}
          actions={
            <StatusBadge tone={node.status === "active" ? "success" : "neutral"}>
              {getNodeStatusLabel(node.status)}
            </StatusBadge>
          }
          className="flex-1"
        />
      </div>

      <NodeDetailTabs node={node} />
    </PageShell>
  );
}
