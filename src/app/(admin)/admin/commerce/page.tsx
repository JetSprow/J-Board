import type { Metadata } from "next";
import { Gift, Sparkles } from "lucide-react";
import { createCoupon, createPromotionRule } from "@/actions/admin/commerce";
import { DetailItem, DetailList } from "@/components/admin/detail-list";
import { ActiveStatusBadge, StatusBadge } from "@/components/admin/status-badge";
import { PageHeader, PageShell, SectionHeader } from "@/components/shared/page-shell";
import { PendingSubmitButton } from "@/components/shared/pending-submit-button";
import { BooleanToggle } from "@/components/ui/boolean-toggle";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCommerceData } from "./commerce-data";
import { CommerceToggleButton } from "./_components/commerce-actions";

const selectClassName = "premium-input w-full appearance-none px-3.5 py-2 text-sm outline-none";

export const metadata: Metadata = {
  title: "商业配置",
  description: "管理优惠券与满减规则。",
};

export default async function AdminCommercePage() {
  const { coupons, promotions } = await getCommerceData();

  return (
    <PageShell>
      <PageHeader
        eyebrow="商业配置"
        title="优惠与奖励"
      />

      <Tabs defaultValue="create" className="space-y-6">
        <TabsList variant="line" className="surface-card p-1">
          <TabsTrigger value="create">新建规则</TabsTrigger>
          <TabsTrigger value="manage">规则列表</TabsTrigger>
        </TabsList>

        <TabsContent value="create">
          <section className="grid gap-5 xl:grid-cols-2">
            <form action={createCoupon} className="form-panel space-y-4">
              <SectionHeader title="新建优惠券" />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="coupon-code">优惠码</Label>
                  <Input id="coupon-code" name="code" placeholder="WELCOME10" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="coupon-name">名称</Label>
                  <Input id="coupon-name" name="name" placeholder="新人礼遇" required />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="coupon-type">优惠类型</Label>
                  <select id="coupon-type" name="discountType" className={selectClassName} defaultValue="AMOUNT_OFF">
                    <option value="AMOUNT_OFF">立减金额</option>
                    <option value="PERCENT_OFF">折扣百分比</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="coupon-value">优惠值</Label>
                  <Input id="coupon-value" name="discountValue" type="number" step="0.01" min="0.01" placeholder="10 或 15" required />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Input name="thresholdAmount" type="number" step="0.01" placeholder="满多少可用" />
                <Input name="totalLimit" type="number" placeholder="总次数" />
                <Input name="perUserLimit" type="number" placeholder="每人次数" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="coupon-public">用户可见</Label>
                <BooleanToggle
                  id="coupon-public"
                  name="isPublic"
                  defaultValue
                  trueLabel="公开展示"
                  falseLabel="仅发放"
                  ariaLabel="用户可见"
                />
              </div>
              <PendingSubmitButton className="w-full" pendingLabel="创建中...">创建优惠券</PendingSubmitButton>
            </form>

            <form action={createPromotionRule} className="form-panel space-y-4">
              <SectionHeader title="新建满减" />
              <div className="space-y-2">
                <Label htmlFor="promotion-name">规则名称</Label>
                <Input id="promotion-name" name="name" placeholder="满百礼遇" required />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="promotion-threshold">门槛金额</Label>
                  <Input id="promotion-threshold" name="thresholdAmount" type="number" step="0.01" min="0.01" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="promotion-discount">减免金额</Label>
                  <Input id="promotion-discount" name="discountAmount" type="number" step="0.01" min="0.01" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="promotion-sort">排序</Label>
                <Input id="promotion-sort" name="sortOrder" type="number" defaultValue={100} />
              </div>
              <PendingSubmitButton className="w-full" pendingLabel="创建中...">创建满减</PendingSubmitButton>
            </form>
          </section>
        </TabsContent>

        <TabsContent value="manage" className="space-y-6">
          <section className="space-y-4">
            <SectionHeader title="优惠券" />
            <div className="grid gap-4 lg:grid-cols-2">
              {coupons.map((coupon) => (
                <article key={coupon.id} className="surface-card rounded-xl p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <span className="flex size-10 items-center justify-center rounded-[1rem] bg-amber-500/10 text-amber-700 dark:text-amber-300"><Gift className="size-4" /></span>
                      <div>
                        <h3 className="font-semibold">{coupon.name}</h3>
                        <p className="mt-1 font-mono text-sm text-primary">{coupon.code}</p>
                      </div>
                    </div>
                    <CommerceToggleButton kind="coupon" id={coupon.id} active={coupon.isActive} />
                  </div>
                  <DetailList className="mt-4">
                    <DetailItem label="优惠">{coupon.discountType === "PERCENT_OFF" ? `${Number(coupon.discountValue)}%` : `¥${Number(coupon.discountValue).toFixed(2)}`}</DetailItem>
                    <DetailItem label="门槛">{coupon.thresholdAmount == null ? "无门槛" : `满 ¥${Number(coupon.thresholdAmount).toFixed(2)}`}</DetailItem>
                    <DetailItem label="可见性">{coupon.isPublic ? "公开" : "仅发放"}</DetailItem>
                    <DetailItem label="使用">订单 {coupon._count.orders} · 发放 {coupon._count.grants}</DetailItem>
                  </DetailList>
                </article>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <SectionHeader title="满减规则" />
            <div className="grid gap-4 lg:grid-cols-2">
              {promotions.map((rule) => (
                <article key={rule.id} className="surface-card rounded-xl p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <span className="flex size-10 items-center justify-center rounded-[1rem] bg-primary/10 text-primary"><Sparkles className="size-4" /></span>
                      <div>
                        <h3 className="font-semibold">{rule.name}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">满 ¥{Number(rule.thresholdAmount).toFixed(2)} 减 ¥{Number(rule.discountAmount).toFixed(2)}</p>
                      </div>
                    </div>
                    <CommerceToggleButton kind="promotion" id={rule.id} active={rule.isActive} />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <ActiveStatusBadge active={rule.isActive} activeLabel="启用中" inactiveLabel="已停用" />
                    <StatusBadge>排序 {rule.sortOrder}</StatusBadge>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
