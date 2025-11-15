import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Calendar } from "lucide-react";
import { getPredictions, Prediction } from "@/lib/state";

const History = () => {
  const [items, setItems] = useState<Prediction[]>([]);
  useEffect(() => {
    setItems(getPredictions());
  }, []);
  const successRate = useMemo(() => {
    const up = items.filter((p) => p.direction === "UP").length;
    const total = items.length || 1;
    return Math.round((up / total) * 100);
  }, [items]);
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold mb-2">Prediction History</h1>
        <p className="text-muted-foreground">
          Review past predictions and their outcomes
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 gradient-card border-primary/20 shadow-elevated">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 rounded-lg bg-success/20">
              <TrendingUp className="w-6 h-6 text-success" />
            </div>
            <div>
              <p className="text-3xl font-bold">{successRate}%</p>
              <p className="text-sm text-muted-foreground">Success Rate</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 gradient-card border-primary/20 shadow-elevated">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 rounded-lg bg-primary/20">
              <Calendar className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-3xl font-bold">{items.length}</p>
              <p className="text-sm text-muted-foreground">Total Predictions</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 gradient-card border-primary/20 shadow-elevated">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 rounded-lg bg-secondary/20">
              <TrendingDown className="w-6 h-6 text-secondary" />
            </div>
            <div>
              <p className="text-3xl font-bold">{items.slice(0, 30).length}</p>
              <p className="text-sm text-muted-foreground">This Month</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="gradient-card border-primary/20 shadow-elevated">
        <div className="p-6 border-b border-border">
          <h2 className="text-xl font-bold">Recent Predictions</h2>
        </div>
        <div className="divide-y divide-border">
          {items.map((item) => (
            <div
              key={item.id}
              className="p-6 hover:bg-muted/20 transition-colors flex items-center justify-between"
            >
              <div className="flex items-center gap-6">
                <div
                  className={`p-3 rounded-lg ${
                    item.direction === "UP" ? "bg-success/20" : "bg-destructive/20"
                  }`}
                >
                  {item.direction === "UP" ? (
                    <TrendingUp className="w-6 h-6 text-success" />
                  ) : (
                    <TrendingDown className="w-6 h-6 text-destructive" />
                  )}
                </div>
                <div>
                  <p className="font-semibold text-lg">{item.symbol}</p>
                  <p className="text-sm text-muted-foreground">{item.date}</p>
                </div>
              </div>

              <div className="flex items-center gap-8">
                <div className="text-right">
                  <p className="font-bold text-lg">{item.confidence}%</p>
                  <p className="text-xs text-muted-foreground">Confidence</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{item.direction}</p>
                  <p className="text-xs text-muted-foreground">Direction</p>
                </div>
                <div>
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                    Saved
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default History;
