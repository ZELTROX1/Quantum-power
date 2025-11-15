import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { createChart, ColorType, CandlestickData, HistogramData, Time } from "lightweight-charts";

type Row = { time: string; open: number; high: number; low: number; close: number; volume: number };

function parseCsv(text: string) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idx = {
    date: header.findIndex((h) => h.includes("date")),
    open: header.findIndex((h) => h.includes("open")),
    high: header.findIndex((h) => h.includes("high")),
    low: header.findIndex((h) => h.includes("low")),
    close: header.findIndex((h) => h.includes("close")),
    volume: header.findIndex((h) => h.includes("vol")),
  };
  const rows: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const date = cols[idx.date]?.trim();
    const open = Number(cols[idx.open]);
    const high = Number(cols[idx.high]);
    const low = Number(cols[idx.low]);
    const close = Number(cols[idx.close]);
    const volume = Number(cols[idx.volume] || 0);
    if (!isNaN(open) && !isNaN(high) && !isNaN(low) && !isNaN(close) && date) {
      rows.push({ time: date, open, high, low, close, volume });
    }
  }
  return rows;
}

async function fetchStooq(ticker: string) {
  const res = await fetch(`https://stooq.com/q/d/l/?s=${ticker.toLowerCase()}&i=d`, { cache: "no-cache" });
  if (!res.ok) throw new Error("fetch_failed");
  const text = await res.text();
  let rows = parseCsv(text);
  if (!rows.length) {
    const res2 = await fetch(`https://stooq.com/q/d/l/?s=${ticker.toLowerCase()}.us&i=d`, { cache: "no-cache" });
    if (res2.ok) {
      const text2 = await res2.text();
      rows = parseCsv(text2);
    }
  }
  return rows;
}

async function fetchYahooOhlc(ticker: string, start?: string, end?: string) {
  const now = new Date();
  const sdt = start ? new Date(start) : new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const edt = end ? new Date(end) : now;
  const p1 = Math.floor(sdt.getTime() / 1000);
  const p2 = Math.floor(edt.getTime() / 1000);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${p1}&period2=${p2}&interval=1d&includePrePost=false`;
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error("fetch_failed");
  const data = await res.json();
  const result = data?.chart?.result?.[0];
  const ts: number[] = result?.timestamp || [];
  const quote = result?.indicators?.quote?.[0] || {};
  const opens: number[] = quote.open || [];
  const highs: number[] = quote.high || [];
  const lows: number[] = quote.low || [];
  const closes: number[] = quote.close || [];
  const vols: number[] = quote.volume || [];
  const out: Row[] = [];
  for (let i = 0; i < ts.length; i++) {
    const d = new Date(ts[i] * 1000).toISOString().slice(0, 10);
    const o = opens[i]; const h = highs[i]; const l = lows[i]; const c = closes[i]; const v = vols[i] || 0;
    if (![o, h, l, c].some((x) => x == null || Number.isNaN(x))) {
      out.push({ time: d, open: Number(o), high: Number(h), low: Number(l), close: Number(c), volume: Number(v) });
    }
  }
  if (!out.length) {
    const res2 = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1y&interval=1d&includePrePost=false`, { cache: "no-cache" });
    if (!res2.ok) return out;
    const data2 = await res2.json();
    const r2 = data2?.chart?.result?.[0];
    const ts2: number[] = r2?.timestamp || [];
    const q2 = r2?.indicators?.quote?.[0] || {};
    const o2: number[] = q2.open || []; const h2: number[] = q2.high || []; const l2: number[] = q2.low || []; const c2: number[] = q2.close || []; const v2: number[] = q2.volume || [];
    for (let i = 0; i < ts2.length; i++) {
      const d = new Date(ts2[i] * 1000).toISOString().slice(0, 10);
      const o = o2[i]; const h = h2[i]; const l = l2[i]; const c = c2[i]; const v = v2[i] || 0;
      if (![o, h, l, c].some((x) => x == null || Number.isNaN(x))) {
        out.push({ time: d, open: Number(o), high: Number(h), low: Number(l), close: Number(c), volume: Number(v) });
      }
    }
  }
  return out;
}

const Charts = () => {
  const [ticker, setTicker] = useState("TQQQ");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  function toBusinessDay(s: string): { year: number; month: number; day: number } {
    const [y, m, d] = s.split("-").map((x) => Number(x));
    return { year: y, month: m, day: d };
  }

  function toUnixTime(s: string): number {
    const t = new Date(s).getTime();
    return Math.floor(t / 1000);
  }

  function sanitizeRows(input: Row[]): Row[] {
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    const map = new Map<string, Row>();
    for (const r of input) {
      if (!r || !iso.test(r.time)) continue;
      const ok = [r.open, r.high, r.low, r.close, r.volume].every((x) => Number.isFinite(x));
      if (!ok) continue;
      // prefer last occurrence to overwrite duplicates
      map.set(r.time, { ...r });
    }
    return Array.from(map.values()).sort((a, b) => a.time.localeCompare(b.time));
  }
  const ref = useRef<HTMLDivElement | null>(null);
  const candleData: CandlestickData[] = useMemo(
    () => sanitizeRows(rows).map((r) => ({ time: toUnixTime(r.time) as unknown as Time, open: r.open, high: r.high, low: r.low, close: r.close })),
    [rows],
  );
  const volData: HistogramData[] = useMemo(
    () => sanitizeRows(rows).map((r) => ({ time: toUnixTime(r.time) as unknown as Time, value: r.volume })),
    [rows],
  );

  useEffect(() => {
    try {
      if (!ref.current || !rows.length) return;
      if (!candleData.length || !volData.length) return;
      ref.current.innerHTML = "";
      const rect = ref.current.getBoundingClientRect();
      const width = (rect && rect.width) ? rect.width : (ref.current.clientWidth || 600);
      const chart = createChart(ref.current, {
        layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "hsl(var(--foreground))" },
        grid: { horzLines: { color: "hsl(var(--border))" }, vertLines: { color: "hsl(var(--border))" } },
        width,
        height: 400,
      });
      chart.applyOptions({
        rightPriceScale: { visible: true, scaleMargins: { top: 0.1, bottom: 0.3 } },
        leftPriceScale: { visible: true, scaleMargins: { top: 0.7, bottom: 0.0 } },
        timeScale: { rightOffset: 5, borderVisible: true },
      });
      const candleSeries = chart.addCandlestickSeries({ upColor: "hsl(var(--success))", downColor: "hsl(var(--destructive))", borderVisible: false, wickUpColor: "hsl(var(--success))", wickDownColor: "hsl(var(--destructive))" });
      const volSeries = chart.addHistogramSeries({ priceScaleId: "left", priceFormat: { type: "volume" }, color: "hsl(var(--primary))", priceLineVisible: false, base: 0 });
      candleSeries.setData(candleData);
      volSeries.setData(volData);
      const ro = new ResizeObserver(() => {
        if (!ref.current) return;
        const w = ref.current.clientWidth || width;
        chart.applyOptions({ width: w });
      });
      ro.observe(ref.current);
      return () => ro.disconnect();
    } catch {
      toast.error("Chart render failed");
    }
  }, [rows, candleData, volData]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploaded = e.target.files?.[0];
    if (!uploaded) return;
    if (!uploaded.name.endsWith(".csv")) {
      toast.error("Upload a CSV file");
      return;
    }
    setFile(uploaded);
    const text = await uploaded.text();
    const parsed = sanitizeRows(parseCsv(text));
    setRows(parsed);
    toast.success("CSV loaded");
  };

  const handleFetch = async () => {
    try {
      const s = startDate || "";
      const e = endDate || "";
      const q = new URLSearchParams({ ticker, start: s, end: e }).toString();
      const res = await fetch(`http://localhost:3002/ohlc?${q}`);
      const data = await res.json();
      const rowsData: Row[] = Array.isArray(data.rows) ? data.rows : [];
      if (!rowsData.length) throw new Error("no_data");
      setRows(sanitizeRows(rowsData));
      toast.success("Data fetched");
    } catch {
      toast.error("Fetch failed. Upload CSV instead.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Charts</h1>
        <p className="text-muted-foreground">Candlesticks and volume</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 gradient-card border-primary/20 shadow-elevated lg:col-span-1">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ticker">Ticker</Label>
              <Input id="ticker" value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder="TQQQ" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Start</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>End</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
            <Button onClick={handleFetch} className="w-full gradient-quantum">Fetch</Button>
            <div className="space-y-2">
              <Label>Upload CSV</Label>
              <Input type="file" accept=".csv" onChange={handleFileUpload} />
            </div>
          </div>
        </Card>
        <Card className="p-6 gradient-card border-primary/20 shadow-elevated lg:col-span-2">
          <div ref={ref} className="w-full" />
        </Card>
      </div>
    </div>
  );
};

export default Charts;