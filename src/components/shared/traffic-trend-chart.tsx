"use client";

import { useEffect, useRef, useState } from "react";
import { Activity } from "lucide-react";
import { EmptyState } from "@/components/shared/page-shell";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface Point {
  date: string;
  valueGb: number;
}

export function TrafficTrendChart({
  data,
  color = "oklch(0.52 0.13 172)",
}: {
  data: Point[];
  color?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const updateWidth = () => {
      setWidth(Math.max(320, Math.floor(element.getBoundingClientRect().width)));
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  if (data.length === 0) {
    return (
      <EmptyState
        icon={<Activity className="size-5" />}
        title="还没有趋势数据"
        description="同步到客户端流量后，这里会展示近 7 天使用曲线。"
        className="border-0 bg-transparent px-3 py-10"
      />
    );
  }

  return (
    <div ref={containerRef} className="h-64 min-w-0 overflow-hidden">
      {width > 0 ? (
        <AreaChart data={data} width={width} height={256}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis unit=" GB" width={60} />
          <Tooltip
            labelFormatter={(label) => `日期：${label}`}
            formatter={(value) =>
              [`${Number(typeof value === "number" ? value : 0).toFixed(2)} GB`, "流量"]
            }
          />
          <Area
            type="monotone"
            dataKey="valueGb"
            name="流量"
            stroke={color}
            fill={color}
            fillOpacity={0.15}
            strokeWidth={2}
          />
        </AreaChart>
      ) : (
        <div className="h-full animate-pulse rounded-xl bg-muted/30" />
      )}
    </div>
  );
}
