"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useThemeColors } from "@/lib/use-theme-colors";

interface KeyDistributionProps {
  data: { key: string; count: number }[];
}

export function KeyDistribution({ data }: KeyDistributionProps) {
  const { chart1 } = useThemeColors();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Key Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data}>
              <XAxis dataKey="key" fontSize={11} angle={-45} textAnchor="end" height={60} />
              <YAxis fontSize={11} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill={chart1} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground">No key data available</p>
        )}
      </CardContent>
    </Card>
  );
}
