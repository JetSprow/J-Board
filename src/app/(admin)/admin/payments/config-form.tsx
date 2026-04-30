"use client";

import { useState } from "react";
import { BooleanToggle } from "@/components/ui/boolean-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { savePaymentConfig } from "@/actions/admin/payments";
import { getErrorMessage } from "@/lib/errors";
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
  fields: Field[];
  currentConfig?: Record<string, string>;
  secretConfigured?: Record<string, boolean>;
  enabled: boolean;
}

export function PaymentConfigForm({
  provider,
  fields,
  currentConfig,
  secretConfigured = {},
  enabled: initialEnabled,
}: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);

  // Track checkbox field values (comma-separated strings)
  const [checkboxValues, setCheckboxValues] = useState<Record<string, Set<string>>>(() => {
    const init: Record<string, Set<string>> = {};
    for (const field of fields) {
      if (field.type === "checkboxes") {
        const raw = currentConfig?.[field.key] || "";
        init[field.key] = new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
      }
    }
    return init;
  });

  function toggleCheckbox(fieldKey: string, value: string) {
    setCheckboxValues((prev) => {
      const next = new Set(prev[fieldKey]);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return { ...prev, [fieldKey]: next };
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    const config: Record<string, string> = {};
    for (const field of fields) {
      if (field.type === "checkboxes") {
        config[field.key] = Array.from(checkboxValues[field.key] ?? []).join(",");
      } else {
        config[field.key] = (formData.get(field.key) as string) || "";
      }
    }

    try {
      await savePaymentConfig(provider, config, enabled);
      for (const field of fields) {
        if (!field.secret) continue;
        const input = e.currentTarget.elements.namedItem(field.key);
        if (input instanceof HTMLInputElement) {
          input.value = "";
        }
      }
      toast.success("保存成功");
    } catch (error) {
      toast.error(getErrorMessage(error, "保存失败"));
    }
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="form-panel space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) =>
          field.type === "checkboxes" ? (
            <div key={field.key} className="sm:col-span-2">
              <Label>{field.label}</Label>
              <div className="mt-3 flex flex-wrap gap-3">
                {field.options?.map((opt) => (
                  <label key={opt.value} className="choice-card flex cursor-pointer items-center gap-2 px-3 py-2">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-border accent-primary"
                      checked={checkboxValues[field.key]?.has(opt.value) ?? false}
                      onChange={() => toggleCheckbox(field.key, opt.value)}
                    />
                    <span className="text-sm">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div key={field.key}>
              <Label>{field.label}</Label>
              <Input
                name={field.key}
                type={field.secret ? "password" : "text"}
                placeholder={field.secret && secretConfigured[field.key] ? "留空保持不变" : field.placeholder}
                defaultValue={field.secret ? "" : currentConfig?.[field.key] || ""}
              />
            </div>
          ),
        )}
      </div>
      <div className="flex flex-col gap-3 border-t border-border/50 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:w-56">
          <Label className="mb-2 block text-xs text-muted-foreground">支付通道状态</Label>
          <BooleanToggle
            value={enabled}
            onChange={setEnabled}
            trueLabel="启用"
            falseLabel="停用"
            ariaLabel="支付通道状态"
          />
        </div>
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "保存中..." : "保存配置"}
        </Button>
      </div>
    </form>
  );
}
