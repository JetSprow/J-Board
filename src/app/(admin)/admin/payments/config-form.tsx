"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, CreditCard, Pencil, ShieldCheck } from "lucide-react";
import { savePaymentConfig } from "@/actions/admin/payments";
import { ActiveStatusBadge, StatusBadge } from "@/components/shared/status-badge";
import { BooleanToggle } from "@/components/ui/boolean-toggle";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Field {
  key: string;
  label: string;
  placeholder?: string;
  secret?: boolean;
  type?: "text" | "checkboxes";
  options?: { value: string; label: string }[];
}

interface Props {
  provider: string;
  providerName: string;
  providerDescription: string;
  fields: Field[];
  currentConfig?: Record<string, string>;
  secretConfigured?: Record<string, boolean>;
  enabled: boolean;
}

function selectedOptionLabels(field: Field, rawValue: string | undefined) {
  const selected = new Set((rawValue ?? "").split(",").map((item) => item.trim()).filter(Boolean));
  return (field.options ?? [])
    .filter((option) => selected.has(option.value))
    .map((option) => option.label);
}

function buildInitialCheckboxValues(fields: Field[], currentConfig?: Record<string, string>) {
  const values: Record<string, Set<string>> = {};

  for (const field of fields) {
    if (field.type !== "checkboxes") continue;
    values[field.key] = new Set(
      (currentConfig?.[field.key] ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    );
  }

  return values;
}

function configCompleteness(fields: Field[], currentConfig: Record<string, string> | undefined, secretConfigured: Record<string, boolean>) {
  let configured = 0;

  for (const field of fields) {
    if (field.secret) {
      if (secretConfigured[field.key]) configured += 1;
      continue;
    }
    if (field.type === "checkboxes") {
      if (selectedOptionLabels(field, currentConfig?.[field.key]).length > 0) configured += 1;
      continue;
    }
    if (currentConfig?.[field.key]?.trim()) configured += 1;
  }

  return { configured, total: fields.length };
}

export function PaymentConfigItem({
  provider,
  providerName,
  providerDescription,
  fields,
  currentConfig,
  secretConfigured = {},
  enabled: initialEnabled,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);
  const [checkboxValues, setCheckboxValues] = useState<Record<string, Set<string>>>(() =>
    buildInitialCheckboxValues(fields, currentConfig),
  );
  const completeness = useMemo(
    () => configCompleteness(fields, currentConfig, secretConfigured),
    [currentConfig, fields, secretConfigured],
  );
  const secretFields = fields.filter((field) => field.secret);
  const configuredSecretCount = secretFields.filter((field) => secretConfigured[field.key]).length;
  const displayName = currentConfig?.displayName?.trim();
  const checkboxSummaries = fields
    .filter((field) => field.type === "checkboxes")
    .flatMap((field) => selectedOptionLabels(field, currentConfig?.[field.key]));

  function toggleCheckbox(fieldKey: string, value: string) {
    setCheckboxValues((current) => {
      const next = new Set(current[fieldKey] ?? []);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return { ...current, [fieldKey]: next };
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const config: Record<string, string> = {};

    for (const field of fields) {
      if (field.type === "checkboxes") {
        config[field.key] = Array.from(checkboxValues[field.key] ?? []).join(",");
      } else {
        config[field.key] = (formData.get(field.key) as string) || "";
      }
    }

    setSaving(true);
    try {
      await savePaymentConfig(provider, config, enabled);
      for (const field of fields) {
        if (!field.secret) continue;
        const input = form.elements.namedItem(field.key);
        if (input instanceof HTMLInputElement) {
          input.value = "";
        }
      }
      toast.success("支付配置已保存");
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error, "保存支付配置失败"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="grid gap-4 border-t border-border/60 px-4 py-4 first:border-t-0 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/10 text-primary">
          <CreditCard className="size-4" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold tracking-tight">{providerName}</h3>
            {displayName && <StatusBadge tone="neutral">{displayName}</StatusBadge>}
          </div>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">{providerDescription}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 lg:justify-end">
        <ActiveStatusBadge active={enabled} activeLabel="已启用" inactiveLabel="未启用" />
        <StatusBadge tone={completeness.configured === completeness.total ? "success" : "neutral"}>
          配置 {completeness.configured}/{completeness.total}
        </StatusBadge>
        {secretFields.length > 0 && (
          <StatusBadge tone={configuredSecretCount === secretFields.length ? "success" : "warning"}>
            密钥 {configuredSecretCount}/{secretFields.length}
          </StatusBadge>
        )}
        {checkboxSummaries.slice(0, 2).map((label) => (
          <StatusBadge key={label} tone="info">{label}</StatusBadge>
        ))}
      </div>

      <Dialog open={open} onOpenChange={(nextOpen) => !saving && setOpen(nextOpen)}>
        <DialogTrigger render={<Button variant="outline" size="sm" className="w-full lg:w-auto" />}>
          <Pencil className="size-3.5" />
          编辑配置
        </DialogTrigger>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <div className="flex size-9 items-center justify-center rounded-lg border border-primary/15 bg-primary/10 text-primary">
              <ShieldCheck className="size-4" />
            </div>
            <DialogTitle>编辑{providerName}</DialogTitle>
            <DialogDescription>{providerDescription}。敏感字段留空会保留当前配置。</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              {fields.map((field) =>
                field.type === "checkboxes" ? (
                  <div key={field.key} className="sm:col-span-2">
                    <Label>{field.label}</Label>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {field.options?.map((option) => {
                        const selected = checkboxValues[field.key]?.has(option.value) ?? false;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => toggleCheckbox(field.key, option.value)}
                            className={cn(
                              "flex min-h-10 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20",
                              selected
                                ? "border-primary/35 bg-primary/10 text-primary"
                                : "border-border bg-muted/20 text-muted-foreground hover:bg-muted/45 hover:text-foreground",
                            )}
                          >
                            <span className="truncate">{option.label}</span>
                            {selected && <Check className="size-4 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div key={field.key} className="space-y-2">
                    <Label htmlFor={`${provider}-${field.key}`}>{field.label}</Label>
                    <Input
                      id={`${provider}-${field.key}`}
                      name={field.key}
                      type={field.secret ? "password" : "text"}
                      placeholder={field.secret && secretConfigured[field.key] ? "留空保持不变" : field.placeholder}
                      defaultValue={field.secret ? "" : currentConfig?.[field.key] || ""}
                    />
                    {field.secret && secretConfigured[field.key] && (
                      <p className="text-xs leading-5 text-muted-foreground">当前密钥已保存，重新填写才会覆盖。</p>
                    )}
                  </div>
                ),
              )}
            </div>

            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Label className="text-sm font-semibold">支付通道状态</Label>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">启用后会出现在用户支付页；启用前必须保证必填项完整。</p>
                </div>
                <div className="w-full sm:w-56">
                  <BooleanToggle
                    value={enabled}
                    onChange={setEnabled}
                    trueLabel="启用"
                    falseLabel="停用"
                    ariaLabel="支付通道状态"
                    disabled={saving}
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
                取消
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "保存中..." : "保存配置"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
