import { ChevronDown, Globe2, MapPin, ScrollText } from "lucide-react";
import { LogDeleteButton } from "@/components/admin/log-delete-button";
import { StatusBadge } from "@/components/shared/status-badge";
import { WORLD_COUNTRY_PATHS } from "@/components/shared/world-map-paths";
import { formatDate } from "@/lib/utils";
import type { SubscriptionRiskGeoSummary } from "@/services/subscription-risk-review";

function projectPoint(latitude: number, longitude: number) {
  return {
    x: ((longitude + 180) / 360) * 360,
    y: ((90 - latitude) / 180) * 180,
  };
}

function radiusForAccess(count: number) {
  return Math.min(7.5, Math.max(3.2, 2.4 + Math.sqrt(count)));
}

function normalizeCountryName(value: string) {
  const normalized = value.trim().toLowerCase();
  const aliases: Record<string, string> = {
    "united states": "united states of america",
    usa: "united states of america",
    "u.s.": "united states of america",
    "u.s.a.": "united states of america",
    russia: "russia",
    "russian federation": "russia",
    vietnam: "vietnam",
    "viet nam": "vietnam",
    "south korea": "south korea",
    korea: "south korea",
    czechia: "czechia",
    "czech republic": "czechia",
  };
  return aliases[normalized] ?? normalized;
}

function WorldRiskMap({ summary }: { summary: SubscriptionRiskGeoSummary }) {
  const points = summary.points.slice(0, 80);
  const activeCountries = new Set(summary.countries.map((country) => normalizeCountryName(country.country)));

  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
      <svg
        viewBox="0 0 360 180"
        className="h-[15rem] w-full bg-[radial-gradient(circle_at_30%_20%,color-mix(in_oklch,var(--primary)_10%,transparent),transparent_30%),linear-gradient(135deg,var(--muted),var(--card))]"
        role="img"
        aria-label="订阅访问与节点连接 IP 世界地图分布"
      >
        <rect width="360" height="180" rx="12" fill="transparent" />
        {[-120, -60, 0, 60, 120].map((longitude) => {
          const x = ((longitude + 180) / 360) * 360;
          return <line key={longitude} x1={x} x2={x} y1="10" y2="170" stroke="var(--border)" strokeDasharray="1 7" strokeOpacity="0.72" />;
        })}
        {[-45, 0, 45].map((latitude) => {
          const y = ((90 - latitude) / 180) * 180;
          return <line key={latitude} x1="10" x2="350" y1={y} y2={y} stroke="var(--border)" strokeDasharray="1 7" strokeOpacity="0.72" />;
        })}
        <g>
          {WORLD_COUNTRY_PATHS.map((country) => {
            const active = activeCountries.has(normalizeCountryName(country.name));
            return (
              <path
                key={country.isoA2 + country.name}
                d={country.path}
                fill={active ? "color-mix(in oklch, var(--primary) 24%, var(--card))" : "color-mix(in oklch, var(--foreground) 7%, var(--card))"}
                stroke="var(--border)"
                strokeWidth={active ? 0.45 : 0.35}
                opacity={active ? 0.96 : 0.72}
              />
            );
          })}
        </g>
        <g>
          {points.map((point) => {
            const { x, y } = projectPoint(point.latitude, point.longitude);
            const color = point.allowed ? "var(--primary)" : "var(--destructive)";
            return (
              <g key={point.key}>
                <title>{point.ip + " / " + point.country + " / " + point.region + " / " + point.city}</title>
                <circle cx={x} cy={y} r={radiusForAccess(point.accessCount) + 4} fill={color} opacity="0.13" />
                <circle cx={x} cy={y} r={radiusForAccess(point.accessCount)} fill={color} stroke="var(--card)" strokeWidth="1.6" />
                <circle cx={x} cy={y} r="1.3" fill="var(--card)" opacity="0.9" />
              </g>
            );
          })}
        </g>
      </svg>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-3 py-2 text-xs text-muted-foreground">
        <span>{points.length > 0 ? "真实边界地图 · 已标注 " + points.length + " 个坐标点" : "真实边界地图 · 没有可用经纬度坐标"}</span>
        <span>圆点越大表示访问越集中</span>
      </div>
    </div>
  );
}

function RiskMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 border-t border-border/60 pt-3 first:border-t-0 first:pt-0 sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0 sm:first:border-l-0 sm:first:pl-0">
      <p className="text-[0.7rem] text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold leading-none">{value}</p>
    </div>
  );
}

function AnalysisLogDetails({ summary }: { summary: SubscriptionRiskGeoSummary }) {
  const logs = summary.analysisLogs;

  return (
    <details className="group rounded-xl border border-border/70 bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-2">
          <ScrollText className="size-4 shrink-0 text-primary" />
          <span className="truncate">分析日志</span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          {logs.length} 条
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
        </span>
      </summary>
      <div className="max-h-[30rem] overflow-auto border-t border-border/60 p-3">
        {logs.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/70 p-3 text-xs text-muted-foreground">暂无分析日志。</p>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <article key={log.id} className="min-w-0 border-t border-border/60 pt-3 first:border-t-0 first:pt-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs font-semibold text-foreground">{log.ip}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(log.createdAt)}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    <StatusBadge tone={log.source === "节点 Xray 日志" ? "info" : "neutral"}>{log.source}</StatusBadge>
                    <StatusBadge tone={log.allowed ? "success" : "warning"}>{log.allowed ? "放行" : "拦截"}</StatusBadge>
                    <LogDeleteButton
                      id={log.id}
                      target="SUBSCRIPTION_ACCESS_LOGS"
                      title="删除这条风控访问日志？"
                      description="删除后无法恢复，只会移除这条访问或节点连接证据，不会删除用户、订阅或风控事件。"
                      successMessage="风控访问日志已删除"
                    />
                  </div>
                </div>
                <p className="mt-2 break-words text-xs leading-5 text-muted-foreground">{log.location}</p>
                {log.detailLines.length > 0 ? (
                  <ul className="mt-2 space-y-1.5 text-xs leading-5 text-foreground/80">
                    {log.detailLines.map((line, index) => (
                      <li key={line + index} className="break-words rounded-md border border-border/60 bg-muted/20 px-2 py-1">
                        {line}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 rounded-md border border-dashed border-border/70 px-2 py-1.5 text-xs text-muted-foreground">
                    系统未写入额外分析详情，仅保留 IP、地区和访问结果。
                  </p>
                )}
                {log.userAgent && <p className="mt-2 truncate font-mono text-[0.7rem] text-muted-foreground">{log.userAgent}</p>}
              </article>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}

export function SubscriptionRiskGeoDetails({ summary }: { summary: SubscriptionRiskGeoSummary }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/10 text-primary">
            <Globe2 className="size-4" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">地理证据</h3>
            <p className="truncate text-xs text-muted-foreground">国家、省区、城市与 IP 的窗口内变化</p>
          </div>
        </div>
        <StatusBadge tone={summary.uniqueCountryCount > 1 ? "danger" : summary.uniqueRegionCount > 1 ? "warning" : "info"}>
          {summary.uniqueCountryCount} 国
        </StatusBadge>
      </div>

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.25fr)_minmax(15rem,0.75fr)]">
        <WorldRiskMap summary={summary} />

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4 2xl:grid-cols-2">
            <RiskMetric label="访问" value={summary.totalLogs} />
            <RiskMetric label="IP" value={summary.uniqueIpCount} />
            <RiskMetric label="省区" value={summary.uniqueRegionCount} />
            <RiskMetric label="城市" value={summary.uniqueCityCount} />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">国家分布</p>
            <div className="max-h-40 space-y-2 overflow-auto pr-1">
              {summary.countries.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border/70 p-3 text-xs leading-5 text-muted-foreground">
                  GeoIP 未识别出国家、省区或城市。
                </p>
              ) : (
                summary.countries.map((country) => (
                  <div key={country.country} className="border-t border-border/60 pt-2 first:border-t-0 first:pt-0">
                    <div className="flex items-start justify-between gap-3">
                      <p className="break-words text-sm font-medium">{country.country}</p>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">{country.accessCount} 次</span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {country.ipCount} IP · {country.regionCount} 省/地区 · {country.cityCount} 城市
                    </p>
                    {(country.topRegions.length > 0 || country.topCities.length > 0) && (
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                        {country.topRegions.join("、") || "未识别省区"} / {country.topCities.join("、") || "未识别城市"}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <details className="group rounded-xl border border-border/70 bg-muted/20">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2">
            <MapPin className="size-4 text-primary" /> IP 访问/连接明细
          </span>
          <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="grid gap-2 border-t border-border/60 p-3 lg:grid-cols-2">
          {summary.recentAccesses.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border/70 p-3 text-xs text-muted-foreground">暂无访问明细。</p>
          ) : (
            summary.recentAccesses.slice(0, 8).map((access) => (
              <div key={access.id} className="min-w-0 border-t border-border/60 pt-2 text-xs leading-5 first:border-t-0 first:pt-0 lg:odd:border-t-0 lg:odd:pt-0 lg:even:border-t-0 lg:even:pt-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-foreground">{access.ip}</span>
                  <StatusBadge tone={access.allowed ? "success" : "warning"}>
                    {access.allowed ? "放行" : access.reason || "拦截"}
                  </StatusBadge>
                </div>
                <p className="mt-1 break-words text-muted-foreground">{access.location}</p>
                <p className="text-muted-foreground">{formatDate(access.createdAt)}</p>
                {access.userAgent && <p className="mt-1 truncate text-muted-foreground">{access.userAgent}</p>}
              </div>
            ))
          )}
        </div>
      </details>

      <AnalysisLogDetails summary={summary} />
    </section>
  );
}
