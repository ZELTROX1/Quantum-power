import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { getPredictions, Prediction } from "@/lib/state";

const Analytics = () => {
  const [preds, setPreds] = useState<Prediction[]>([]);
  useEffect(() => {
    setPreds(getPredictions());
  }, []);
  const performanceData = useMemo(() => {
    const byMonth: Record<string, { accuracy: number; predictions: number; up: number }> = {};
    preds.forEach((p) => {
      const m = p.date.slice(0, 7);
      byMonth[m] = byMonth[m] || { accuracy: 0, predictions: 0, up: 0 };
      byMonth[m].predictions += 1;
      if (p.direction === "UP") byMonth[m].up += 1;
    });
    return Object.entries(byMonth).map(([month, v]) => ({ month, accuracy: Math.round((v.up / v.predictions) * 100), predictions: v.predictions }));
  }, [preds]);
  const directionData = useMemo(() => {
    const bull = preds.filter((p) => p.direction === "UP").length;
    const bear = preds.length - bull;
    return [
      { name: "Bullish", value: bull, color: "hsl(var(--success))" },
      { name: "Bearish", value: bear, color: "hsl(var(--destructive))" },
    ];
  }, [preds]);
  const confidenceDistribution = useMemo(() => {
    const buckets = [0, 0, 0, 0, 0];
    preds.forEach((p) => {
      const c = p.confidence;
      if (c < 60) buckets[0] += 1; else if (c < 70) buckets[1] += 1; else if (c < 80) buckets[2] += 1; else if (c < 90) buckets[3] += 1; else buckets[4] += 1;
    });
    return [
      { range: "50-60%", count: buckets[0] },
      { range: "60-70%", count: buckets[1] },
      { range: "70-80%", count: buckets[2] },
      { range: "80-90%", count: buckets[3] },
      { range: "90-100%", count: buckets[4] },
    ];
  }, [preds]);
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold mb-2">Analytics</h1>
        <p className="text-muted-foreground">
          Detailed insights into model performance and predictions
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 gradient-card border-primary/20 shadow-elevated">
          <h2 className="text-xl font-bold mb-6">Performance Over Time</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="accuracy"
                stroke="hsl(var(--primary))"
                strokeWidth={3}
                name="Accuracy %"
              />
              <Line
                type="monotone"
                dataKey="predictions"
                stroke="hsl(var(--secondary))"
                strokeWidth={3}
                name="Predictions"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6 gradient-card border-primary/20 shadow-elevated">
          <h2 className="text-xl font-bold mb-6">Direction Distribution</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={directionData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {directionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className="p-6 gradient-card border-primary/20 shadow-elevated">
        <h2 className="text-xl font-bold mb-6">Confidence Distribution</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={confidenceDistribution}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="range" stroke="hsl(var(--muted-foreground))" />
            <YAxis stroke="hsl(var(--muted-foreground))" />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
              }}
            />
            <Bar dataKey="count" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 gradient-card border-primary/20 shadow-elevated">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            Average Confidence
          </h3>
          <p className="text-3xl font-bold mb-1">84.7%</p>
          <p className="text-xs text-success">+2.3% from last month</p>
        </Card>

        <Card className="p-6 gradient-card border-primary/20 shadow-elevated">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            Most Predicted Asset
          </h3>
          <p className="text-3xl font-bold mb-1">BTC/USD</p>
          <p className="text-xs text-muted-foreground">342 predictions</p>
        </Card>

        <Card className="p-6 gradient-card border-primary/20 shadow-elevated">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            Best Day
          </h3>
          <p className="text-3xl font-bold mb-1">96.2%</p>
          <p className="text-xs text-muted-foreground">April 15, 2024</p>
        </Card>
      </div>
    </div>
  );
};

export default Analytics;
