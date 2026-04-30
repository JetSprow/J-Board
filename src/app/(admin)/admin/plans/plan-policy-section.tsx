"use client";

import type { Dispatch, SetStateAction } from "react";
import { BooleanToggle } from "@/components/ui/boolean-toggle";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PlanFormValue, PlanType } from "./plan-form-types";

type FieldId = (name: string) => string;
type RenewalPricingMode = "PER_DAY" | "FIXED_DURATION";
type TopupPricingMode = "PER_GB" | "FIXED_AMOUNT";

interface PlanPolicySectionProps {
  fieldId: FieldId;
  type: PlanType;
  plan?: PlanFormValue;
  allowRenewal: boolean;
  setAllowRenewal: Dispatch<SetStateAction<boolean>>;
  allowTrafficTopup: boolean;
  setAllowTrafficTopup: Dispatch<SetStateAction<boolean>>;
  renewalPricingMode: RenewalPricingMode;
  setRenewalPricingMode: Dispatch<SetStateAction<RenewalPricingMode>>;
  topupPricingMode: TopupPricingMode;
  setTopupPricingMode: Dispatch<SetStateAction<TopupPricingMode>>;
}

export function PlanPolicySection({
  fieldId,
  type,
  plan,
  allowRenewal,
  setAllowRenewal,
  allowTrafficTopup,
  setAllowTrafficTopup,
  renewalPricingMode,
  setRenewalPricingMode,
  topupPricingMode,
  setTopupPricingMode,
}: PlanPolicySectionProps) {
  return (
    <>
      <div className="form-panel grid gap-4 sm:grid-cols-2">
        <div className="flex items-center justify-between gap-4 rounded-lg bg-muted/20 p-3">
          <div>
            <p id={fieldId("allowRenewal-label")} className="text-sm font-medium">开放续费</p>
            <p className="text-xs text-muted-foreground">用户可拖动选择续费时长</p>
          </div>
          <div className="w-40">
            <BooleanToggle
              value={allowRenewal}
              onChange={setAllowRenewal}
              trueLabel="开放"
              falseLabel="关闭"
              ariaLabel="开放续费"
            />
          </div>
        </div>
        {type === "PROXY" && (
          <div className="flex items-center justify-between gap-4 rounded-lg bg-muted/20 p-3">
            <div>
              <p id={fieldId("allowTrafficTopup-label")} className="text-sm font-medium">开放增流量</p>
              <p className="text-xs text-muted-foreground">用户可拖动选择加多少 GB</p>
            </div>
            <div className="w-40">
              <BooleanToggle
                value={allowTrafficTopup}
                onChange={setAllowTrafficTopup}
                trueLabel="开放"
                falseLabel="关闭"
                ariaLabel="开放增流量"
              />
            </div>
          </div>
        )}
      </div>

      {allowRenewal && (
        <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor={fieldId("renewalPricingMode")}>续费计价</Label>
              <input type="hidden" name="renewalPricingMode" value={renewalPricingMode} />
              <Select value={renewalPricingMode} onValueChange={(value) => setRenewalPricingMode(value as RenewalPricingMode)}>
                <SelectTrigger id={fieldId("renewalPricingMode")} className="w-full">
                  <SelectValue>
                    {(value) => value === "PER_DAY" ? "按天计费" : "固定周期计费"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PER_DAY">按天计费</SelectItem>
                  <SelectItem value="FIXED_DURATION">固定周期计费</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor={fieldId("renewalPrice")}>
                {renewalPricingMode === "PER_DAY" ? "续费价格（¥/天）" : "续费价格（¥/周期）"}
              </Label>
              <Input
                id={fieldId("renewalPrice")}
                name="renewalPrice"
                type="number"
                step="0.01"
                min={0.01}
                required
                defaultValue={plan?.renewalPrice ?? ""}
                placeholder={renewalPricingMode === "PER_DAY" ? "例如 1" : "例如 29.9"}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {renewalPricingMode === "FIXED_DURATION" ? (
              <div>
                <Label htmlFor={fieldId("renewalDurationDays")}>周期天数</Label>
                <Input
                  id={fieldId("renewalDurationDays")}
                  name="renewalDurationDays"
                  type="number"
                  min={1}
                  required
                  defaultValue={plan?.renewalDurationDays ?? plan?.durationDays ?? ""}
                  placeholder="例如 30"
                />
              </div>
            ) : (
              <>
                <div>
                  <Label htmlFor={fieldId("renewalMinDays")}>最小续费天数</Label>
                  <Input
                    id={fieldId("renewalMinDays")}
                    name="renewalMinDays"
                    type="number"
                    min={1}
                    defaultValue={plan?.renewalMinDays ?? ""}
                    placeholder="例如 1"
                  />
                </div>
                <div>
                  <Label htmlFor={fieldId("renewalMaxDays")}>最大续费天数</Label>
                  <Input
                    id={fieldId("renewalMaxDays")}
                    name="renewalMaxDays"
                    type="number"
                    min={1}
                    defaultValue={plan?.renewalMaxDays ?? ""}
                    placeholder="例如 180"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {type === "PROXY" && allowTrafficTopup && (
        <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor={fieldId("topupPricingMode")}>增流量计价</Label>
              <input type="hidden" name="topupPricingMode" value={topupPricingMode} />
              <Select value={topupPricingMode} onValueChange={(value) => setTopupPricingMode(value as TopupPricingMode)}>
                <SelectTrigger id={fieldId("topupPricingMode")} className="w-full">
                  <SelectValue>
                    {(value) => value === "FIXED_AMOUNT" ? "固定金额" : "按 GB 计费"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PER_GB">按 GB 计费</SelectItem>
                  <SelectItem value="FIXED_AMOUNT">固定金额</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {topupPricingMode === "PER_GB" ? (
              <div>
                <Label htmlFor={fieldId("topupPricePerGb")}>加流量价格（¥/GB）</Label>
                <Input
                  id={fieldId("topupPricePerGb")}
                  name="topupPricePerGb"
                  type="number"
                  step="0.01"
                  min={0.01}
                  required
                  defaultValue={plan?.topupPricePerGb ?? ""}
                  placeholder="例如 0.8"
                />
              </div>
            ) : (
              <div>
                <Label htmlFor={fieldId("topupFixedPrice")}>固定加流量金额（¥）</Label>
                <Input
                  id={fieldId("topupFixedPrice")}
                  name="topupFixedPrice"
                  type="number"
                  step="0.01"
                  min={0.01}
                  required
                  defaultValue={plan?.topupFixedPrice ?? ""}
                  placeholder="例如 9.9"
                />
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor={fieldId("minTopupGb")}>最小增流量（GB）</Label>
              <Input
                id={fieldId("minTopupGb")}
                name="minTopupGb"
                type="number"
                min={1}
                defaultValue={plan?.minTopupGb ?? ""}
                placeholder="默认 1"
              />
            </div>
            <div>
              <Label htmlFor={fieldId("maxTopupGb")}>最大增流量（GB）</Label>
              <Input
                id={fieldId("maxTopupGb")}
                name="maxTopupGb"
                type="number"
                min={1}
                defaultValue={plan?.maxTopupGb ?? ""}
                placeholder="留空=按流量池剩余额度"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
