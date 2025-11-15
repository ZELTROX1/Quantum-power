import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Activity, Zap } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { getPredictions, Prediction } from "@/lib/state";

const Dashboard = () => {
  const [preds, setPreds] = useState<Prediction[]>([]);
  useEffect(() => {
    setPreds(getPredictions());
  }, []);
  const trend = useMemo(() => {
    const last = preds.slice(0, 7).reverse();
    return last.map((p) => ({ date: p.date, confidence: p.confidence }));
  }, [preds]);
  const accuracy = useMemo(() => {
    const up = preds.filter((p) => p.direction === "UP").length;
    const total = preds.length || 1;
    return Math.round((up / total) * 100);
  }, [preds]);
  const totalPredictions = preds.length;
  const lastDirection = preds[0]?.direction;
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor your quantum predictions and model performance
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6 gradient-card border-primary/20 shadow-elevated hover:shadow-glow transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-lg bg-success/20">
              <TrendingUp className="w-6 h-6 text-success" />
            </div>
            <span className="text-xs text-success font-medium">Live</span>
          </div>
          <h3 className="text-2xl font-bold mb-1">{accuracy}%</h3>
          <p className="text-sm text-muted-foreground">Approx. UP share</p>
        </Card>

        <Card className="p-6 gradient-card border-primary/20 shadow-elevated hover:shadow-glow transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-lg bg-primary/20">
              <Activity className="w-6 h-6 text-primary" />
            </div>
            <span className="text-xs text-primary font-medium">Active</span>
          </div>
          <h3 className="text-2xl font-bold mb-1">{totalPredictions}</h3>
          <p className="text-sm text-muted-foreground">Total Predictions</p>
        </Card>

        <Card className="p-6 gradient-card border-primary/20 shadow-elevated hover:shadow-glow transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-lg bg-secondary/20">
              <Zap className="w-6 h-6 text-secondary" />
            </div>
            <span className="text-xs text-secondary font-medium">Quantum</span>
          </div>
          <h3 className="text-2xl font-bold mb-1">SMA Heuristic</h3>
          <p className="text-sm text-muted-foreground">Client-side</p>
        </Card>

        <Card className="p-6 gradient-card border-primary/20 shadow-elevated hover:shadow-glow transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-lg bg-accent/20">
              <TrendingDown className="w-6 h-6 text-accent" />
            </div>
            <span className="text-xs text-accent font-medium">Live</span>
          </div>
          <h3 className="text-2xl font-bold mb-1">{lastDirection || "N/A"}</h3>
          <p className="text-sm text-muted-foreground">Last Direction</p>
        </Card>
      </div>

      <Card className="p-6 gradient-card border-primary/20 shadow-elevated">
        <h2 className="text-xl font-bold mb-6">Model Confidence Trend</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
            <YAxis stroke="hsl(var(--muted-foreground))" />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
              }}
            />
            <Line
              type="monotone"
              dataKey="confidence"
              stroke="hsl(var(--primary))"
              strokeWidth={3}
              dot={{ fill: "hsl(var(--primary))", r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 gradient-card border-primary/20 shadow-elevated">
          <h2 className="text-xl font-bold mb-4">Recent Predictions</h2>
          <div className="space-y-4">
            {[
              { symbol: "BTC/USD", direction: "UP", confidence: 92, time: "2 min ago" },
              { symbol: "ETH/USD", direction: "UP", confidence: 85, time: "5 min ago" },
              { symbol: "SPY", direction: "DOWN", confidence: 78, time: "8 min ago" },
            ].map((pred, i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border border-border">
                <div className="flex items-center gap-4">
                  <div
                    className={`p-2 rounded-lg ${
                      pred.direction === "UP" ? "bg-success/20" : "bg-destructive/20"
                    }`}
                  >
                    {pred.direction === "UP" ? (
                      <TrendingUp className="w-5 h-5 text-success" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-destructive" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold">{pred.symbol}</p>
                    <p className="text-sm text-muted-foreground">{pred.time}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg">{pred.confidence}%</p>
                  <p className="text-xs text-muted-foreground">Confidence</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 gradient-card border-primary/20 shadow-elevated">
          <h2 className="text-xl font-bold mb-4">Model Status</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 rounded-lg bg-muted/50">
              <span className="text-sm text-muted-foreground">Quantum Layers</span>
              <span className="font-semibold">8</span>
            </div>
            <div className="flex justify-between items-center p-4 rounded-lg bg-muted/50">
              <span className="text-sm text-muted-foreground">Parameters</span>
              <span className="font-semibold">2,048</span>
            </div>
            <div className="flex justify-between items-center p-4 rounded-lg bg-muted/50">
              <span className="text-sm text-muted-foreground">Training Epochs</span>
              <span className="font-semibold">500</span>
            </div>
            <div className="flex justify-between items-center p-4 rounded-lg bg-muted/50">
              <span className="text-sm text-muted-foreground">Status</span>
              <span className="font-semibold text-success flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                Active
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
