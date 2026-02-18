"use client";

import { useState, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";
import { BPS } from "@meridian/shared";
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useWelfareHistory,
  type Timeframe,
} from "@/hooks/useWelfareHistory";

const chartConfig = {
  welfare: {
    label: "YES Price",
    color: "#8BAA6E",
  },
} satisfies ChartConfig;

const TIMEFRAMES: Timeframe[] = ["1H", "6H", "1D", "ALL"];

function formatTime(timestamp: number, timeframe: Timeframe): string {
  const d = new Date(timestamp);
  if (timeframe === "1H" || timeframe === "6H") {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (timeframe === "1D") {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

interface PriceTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload: { timestamp: number; welfare: number };
  }>;
}

function PriceTooltipContent({ active, payload }: PriceTooltipProps) {
  if (!active || !payload?.length) return null;

  const point = payload[0];
  const time = new Date(point.payload.timestamp);

  return (
    <div className="rounded-lg border border-meridian-border bg-meridian-surface px-3 py-2 shadow-xl">
      <div className="font-mono text-lg font-bold text-yes">
        {point.value.toFixed(1)}%
      </div>
      <div className="text-xs text-neutral-500">
        {time.toLocaleDateString([], { month: "short", day: "numeric" })}{" "}
        {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </div>
    </div>
  );
}

interface PriceChartProps {
  decisionId: bigint;
  proposalId: number;
  currentYesPrice: number;
}

export function PriceChart({
  decisionId,
  proposalId,
  currentYesPrice,
}: PriceChartProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>("ALL");
  const { data, isLoading } = useWelfareHistory(
    decisionId,
    proposalId,
    timeframe,
  );

  const pct = Math.min(100, Math.max(0, (currentYesPrice / BPS) * 100));

  const change = useMemo(() => {
    if (data.length < 2) return null;
    const first = data[0].welfare;
    const last = data[data.length - 1].welfare;
    return last - first;
  }, [data]);

  const chartData = useMemo(() => {
    if (data.length === 0) {
      return [{ timestamp: Date.now(), welfare: pct }];
    }
    return data;
  }, [data, pct]);

  return (
    <div>
      {/* Header: current price + timeframe selector */}
      <div className="mb-4 flex items-end justify-between">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-4xl font-bold text-yes">
              {pct.toFixed(1)}%
            </span>
            <span className="text-lg text-neutral-500">YES</span>
          </div>
          {change !== null && (
            <div
              className={`mt-1 font-mono text-sm ${change >= 0 ? "text-yes" : "text-no"}`}
            >
              {change >= 0 ? "+" : ""}
              {change.toFixed(1)}pp
            </div>
          )}
        </div>

        <Tabs
          value={timeframe}
          onValueChange={(v) => setTimeframe(v as Timeframe)}
        >
          <TabsList className="h-8 bg-meridian-surface border border-meridian-border">
            {TIMEFRAMES.map((tf) => (
              <TabsTrigger
                key={tf}
                value={tf}
                className="px-3 py-1 text-xs font-mono data-[state=active]:bg-meridian-gold/20 data-[state=active]:text-meridian-gold data-[state=active]:shadow-none text-neutral-500"
              >
                {tf}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Chart */}
      {isLoading ? (
        <div className="flex h-[280px] items-center justify-center">
          <div className="animate-pulse text-neutral-500">
            Loading chart data...
          </div>
        </div>
      ) : (
        <ChartContainer config={chartConfig} className="h-[280px] w-full aspect-auto">
          <AreaChart
            data={chartData}
            margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
          >
            <defs>
              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8BAA6E" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#8BAA6E" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#1E1E2A"
              vertical={false}
            />
            <XAxis
              dataKey="timestamp"
              tickFormatter={(v) => formatTime(v, timeframe)}
              stroke="#404040"
              tick={{ fill: "#666", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              minTickGap={40}
            />
            <YAxis
              domain={[0, 100]}
              stroke="#404040"
              tick={{ fill: "#666", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
              width={45}
            />
            <ChartTooltip
              content={<PriceTooltipContent />}
              cursor={{
                stroke: "#D4A853",
                strokeWidth: 1,
                strokeDasharray: "4 4",
              }}
            />
            <Area
              type="monotone"
              dataKey="welfare"
              stroke="#8BAA6E"
              strokeWidth={2}
              fill="url(#priceGradient)"
              dot={false}
              activeDot={{
                r: 4,
                fill: "#8BAA6E",
                stroke: "#0A0A0F",
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ChartContainer>
      )}

      {/* Compact price bar */}
      <div className="mt-3 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-no/20">
          <div
            className="h-full rounded-full bg-yes transition-all duration-700 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex gap-3 font-mono text-xs text-neutral-500">
          <span>
            {pct.toFixed(1)}% <span className="text-yes">YES</span>
          </span>
          <span>
            {(100 - pct).toFixed(1)}% <span className="text-no">NO</span>
          </span>
        </div>
      </div>
    </div>
  );
}
