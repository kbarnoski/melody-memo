"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface ChordFrequencyProps {
  data: { chord: string; count: number }[];
}

export function ChordFrequency({ data }: ChordFrequencyProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Most Used Chords</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.slice(0, 15)} layout="vertical">
              <XAxis type="number" fontSize={11} allowDecimals={false} />
              <YAxis type="category" dataKey="chord" fontSize={11} width={60} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground">No chord data available</p>
        )}
      </CardContent>
    </Card>
  );
}
