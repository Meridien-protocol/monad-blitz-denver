"use client";

import { useState, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useMultiWelfareHistory,
  type Timeframe,
} from "@/hooks/useMultiWelfareHistory";

const PROPOSAL_COLORS = [
  "#8BAA6E",
  "#D4A853",
  "#7BA7C9",
  "#C4604A",
  "#B07CC6",
  "#6EC4B8",
  "#CC8E6B",
  "#8E8EC4",
];

const TIMEFRAMES: Timeframe[] = ["1H", "6H", "1D", "ALL"];

function formatTime(timestamp: number, timeframe: Timeframe): string {
  const d = new Date(timestamp);
  if (timeframe === "ALL") {
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  }
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
  payload: { timestamp: number };
}

function MultiTooltipContent({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}) {
  if (!active || !payload?.length) return null;

  const time = new Date(payload[0].payload.timestamp);

  return (
    <div className="rounded-lg border border-meridian-border bg-meridian-surface px-3 py-2 shadow-xl">
      <div className="mb-1.5 text-xs text-neutral-500">
        {time.toLocaleDateString([], { month: "short", day: "numeric" })}{" "}
        {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </div>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-sm">
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-neutral-400">{entry.name}</span>
          <span className="ml-auto font-mono font-bold text-white">
            {entry.value.toFixed(1)}%
          </span>
        </div>
      ))}
    </div>
  );
}

interface DecisionWelfareChartProps {
  decisionId: bigint;
  proposalCount: number;
  proposalNames: string[];
}

export function DecisionWelfareChart({
  decisionId,
  proposalCount,
  proposalNames,
}: DecisionWelfareChartProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>("ALL");
  const { data, isLoading } = useMultiWelfareHistory(
    decisionId,
    proposalCount,
    proposalNames,
    timeframe,
  );

  const chartConfig = useMemo(() => {
    const config: ChartConfig = {};
    for (let i = 0; i < proposalCount; i++) {
      const key = proposalNames[i] || `Proposal ${i}`;
      config[key] = {
        label: key,
        color: PROPOSAL_COLORS[i % PROPOSAL_COLORS.length],
      };
    }
    return config;
  }, [proposalCount, proposalNames]);

  const keys = useMemo(
    () =>
      Array.from({ length: proposalCount }, (_, i) =>
        proposalNames[i] || `Proposal ${i}`,
      ),
    [proposalCount, proposalNames],
  );

  return (
    <section className="rounded-lg border border-meridian-border bg-meridian-surface p-6">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
            Welfare Over Time
          </h2>
          <div className="mt-1 flex flex-wrap gap-4">
            {keys.map((key, i) => (
              <div key={key} className="flex items-center gap-1.5 text-xs">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{
                    backgroundColor:
                      PROPOSAL_COLORS[i % PROPOSAL_COLORS.length],
                  }}
                />
                <span className="text-neutral-400">{key}</span>
              </div>
            ))}
          </div>
        </div>

        <Tabs
          value={timeframe}
          onValueChange={(v) => setTimeframe(v as Timeframe)}
        >
          <TabsList className="h-8 border border-meridian-border bg-meridian-surface">
            {TIMEFRAMES.map((tf) => (
              <TabsTrigger
                key={tf}
                value={tf}
                className="px-3 py-1 font-mono text-xs text-neutral-500 data-[state=active]:bg-meridian-gold/20 data-[state=active]:text-meridian-gold data-[state=active]:shadow-none"
              >
                {tf}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <div className="flex h-[300px] items-center justify-center">
          <div className="animate-pulse text-neutral-500">
            Loading chart data...
          </div>
        </div>
      ) : data.length === 0 ? (
        <div className="flex h-[300px] items-center justify-center">
          <div className="text-neutral-600">
            No trades yet -- chart will populate as trading begins
          </div>
        </div>
      ) : (
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[300px] w-full"
        >
          <AreaChart
            data={data}
            margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
          >
            <defs>
              {keys.map((key, i) => (
                <linearGradient
                  key={key}
                  id={`gradient-${i}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor={PROPOSAL_COLORS[i % PROPOSAL_COLORS.length]}
                    stopOpacity={0.25}
                  />
                  <stop
                    offset="100%"
                    stopColor={PROPOSAL_COLORS[i % PROPOSAL_COLORS.length]}
                    stopOpacity={0.02}
                  />
                </linearGradient>
              ))}
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
              content={<MultiTooltipContent />}
              cursor={{
                stroke: "#D4A853",
                strokeWidth: 1,
                strokeDasharray: "4 4",
              }}
            />
            {keys.map((key, i) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stroke={PROPOSAL_COLORS[i % PROPOSAL_COLORS.length]}
                strokeWidth={2}
                fill={`url(#gradient-${i})`}
                dot={false}
                activeDot={{
                  r: 4,
                  fill: PROPOSAL_COLORS[i % PROPOSAL_COLORS.length],
                  stroke: "#0A0A0F",
                  strokeWidth: 2,
                }}
              />
            ))}
          </AreaChart>
        </ChartContainer>
      )}
    </section>
  );
}
