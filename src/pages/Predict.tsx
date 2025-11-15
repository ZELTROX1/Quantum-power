import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, TrendingUp, TrendingDown, Calendar } from "lucide-react";
import { toast } from "sonner";
import { addPrediction } from "@/lib/state";
import * as tf from "@tensorflow/tfjs";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";

const Predict = () => {
  const [file, setFile] = useState<File | null>(null);
  const [ticker, setTicker] = useState("TQQQ");
  const [customSymbol, setCustomSymbol] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [prediction, setPrediction] = useState<{
    direction: "UP" | "DOWN";
    confidence: number;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultMeta, setResultMeta] = useState<{ symbol: string; date: string; source?: string; points?: number } | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (uploadedFile) {
      if (uploadedFile.name.endsWith(".csv")) {
        setFile(uploadedFile);
        toast.success("CSV file uploaded successfully!");
      } else {
        toast.error("Please upload a CSV file");
      }
    }
  };

  async function fetchStooq(t: string) {
    const res = await fetch(`https://stooq.com/q/d/l/?s=${t.toLowerCase()}&i=d`);
    if (!res.ok) throw new Error("fetch_failed");
    const text = await res.text();
    const lines = text.trim().split(/\r?\n/);
    const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const idx = {
      date: header.findIndex((h) => h.includes("date")),
      close: header.findIndex((h) => h.includes("close")),
    };
    const arr: { date: string; close: number }[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",");
      const d = cols[idx.date]?.trim();
      const c = Number(cols[idx.close]);
      if (d && !isNaN(c)) arr.push({ date: d, close: c });
    }
    return arr;
  }

  async function fetchYahoo(t: string, s?: string, e?: string) {
    const now = new Date();
    const start = s ? new Date(s) : new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const end = e ? new Date(e) : now;
    const p1 = Math.floor(start.getTime() / 1000);
    const p2 = Math.floor(end.getTime() / 1000);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(t)}?period1=${p1}&period2=${p2}&interval=1d&includePrePost=false`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("fetch_failed");
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    const ts: number[] = result?.timestamp || [];
    const quote = result?.indicators?.quote?.[0];
    const closes: number[] = quote?.close || [];
    const arr: { date: string; close: number }[] = [];
    for (let i = 0; i < ts.length; i++) {
      const d = new Date(ts[i] * 1000).toISOString().slice(0, 10);
      const c = closes[i];
      if (!isNaN(c)) arr.push({ date: d, close: c });
    }
    if (!arr.length) {
      const url2 = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(t)}?range=1y&interval=1d&includePrePost=false`;
      const res2 = await fetch(url2);
      if (!res2.ok) return arr;
      const data2 = await res2.json();
      const r2 = data2?.chart?.result?.[0];
      const ts2: number[] = r2?.timestamp || [];
      const q2 = r2?.indicators?.quote?.[0];
      const c2: number[] = q2?.close || [];
      for (let i = 0; i < ts2.length; i++) {
        const d = new Date(ts2[i] * 1000).toISOString().slice(0, 10);
        const c = c2[i];
        if (!isNaN(c)) arr.push({ date: d, close: c });
      }
    }
    return arr;
  }

  async function fetchStooqClient(t: string, s?: string, e?: string) {
    const res = await fetch(`https://stooq.com/q/d/l/?s=${t.toLowerCase()}&i=d`, { cache: "no-cache" });
    if (!res.ok) throw new Error("fetch_failed");
    const text = await res.text();
    const lines = text.trim().split(/\r?\n/);
    const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const idx = {
      date: header.findIndex((h) => h.includes("date")),
      close: header.findIndex((h) => h.includes("close")),
    };
    const sdt = s ? new Date(s) : null;
    const edt = e ? new Date(e) : null;
    const out: { date: string; close: number }[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",");
      const d = cols[idx.date]?.trim();
      const c = Number(cols[idx.close]);
      if (!d || isNaN(c)) continue;
      const dd = new Date(d);
      if ((!sdt || dd >= sdt) && (!edt || dd <= edt)) out.push({ date: d, close: c });
    }
    return out;
  }

  async function fetchYahooCsvClient(t: string, s?: string, e?: string) {
    const now = new Date();
    const start = s ? new Date(s) : new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const end = e ? new Date(e) : now;
    const p1 = Math.floor(start.getTime() / 1000);
    const p2 = Math.floor(end.getTime() / 1000);
    const url = `https://query1.finance.yahoo.com/v7/finance/download/${encodeURIComponent(t)}?period1=${p1}&period2=${p2}&interval=1d&events=history&includeAdjustedClose=true`;
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw new Error("fetch_failed");
    const text = await res.text();
    const lines = text.trim().split(/\r?\n/);
    const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const idx = {
      date: header.findIndex((h) => h.includes("date")),
      close: header.findIndex((h) => h.includes("close")),
      adj: header.findIndex((h) => h.includes("adj close")),
    };
    const out: { date: string; close: number }[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",");
      const d = cols[idx.date]?.trim();
      const cRaw = idx.adj >= 0 ? cols[idx.adj] : cols[idx.close];
      const c = Number(cRaw);
      if (d && !isNaN(c)) out.push({ date: d, close: c });
    }
    return out;
  }

  function sma(values: number[], period: number) {
    const out: number[] = [];
    for (let i = 0; i < values.length; i++) {
      if (i + 1 < period) { out.push(NaN); continue; }
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += values[j];
      out.push(sum / period);
    }
    return out;
  }

  function makeSequences(vals: number[], window = 20) {
    const X: number[][] = [];
    const y: number[] = [];
    for (let i = 0; i < vals.length - window - 1; i++) {
      const seq = vals.slice(i, i + window);
      const next = vals[i + window + 1];
      const cur = vals[i + window];
      X.push(seq.map((v) => v));
      y.push(next >= cur ? 1 : 0);
    }
    return { X, y };
  }

  async function trainAndPredict(vals: number[]) {
    const window = 20;
    const { X, y } = makeSequences(vals, window);
    if (X.length < 50) throw new Error("insufficient_data");
    const split = Math.floor(X.length * 0.8);
    const Xtrain = X.slice(0, split);
    const ytrain = y.slice(0, split);
    const Xval = X.slice(split);
    const yval = y.slice(split);
    const xTrain = tf.tensor2d(Xtrain);
    const yTrain = tf.tensor2d(ytrain.map((v) => [v]));
    const xVal = tf.tensor2d(Xval);
    const yVal = tf.tensor2d(yval.map((v) => [v]));
    const model = tf.sequential();
    model.add(tf.layers.dense({ units: 64, activation: "relu", inputShape: [window] }));
    model.add(tf.layers.dense({ units: 32, activation: "relu" }));
    model.add(tf.layers.dense({ units: 1, activation: "sigmoid" }));
    model.compile({ optimizer: tf.train.adam(0.001), loss: "binaryCrossentropy", metrics: ["accuracy"] });
    await model.fit(xTrain, yTrain, { epochs: 15, batchSize: 32, validationData: [xVal, yVal], verbose: 0 });
    const lastSeq = vals.slice(vals.length - window);
    const prob = (model.predict(tf.tensor2d([lastSeq])) as tf.Tensor).dataSync()[0] || 0.5;
    xTrain.dispose(); yTrain.dispose(); xVal.dispose(); yVal.dispose();
    return prob;
  }

  function fastPredict(vals: number[]) {
    const p = 20;
    if (vals.length < p) return { dir: "DOWN" as const, conf: 50 };
    const s = sma(vals, p);
    const last = vals[vals.length - 1];
    const m = s[s.length - 1];
    if (!m || Number.isNaN(m)) return { dir: "DOWN" as const, conf: 50 };
    const dir = last > m ? "UP" : "DOWN";
    const conf = Math.min(95, Math.max(55, Math.round(Math.abs((last - m) / m) * 100)));
    return { dir, conf };
  }

  async function fetchWithTimeout(url: string, options: RequestInit, ms = 8000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      return res;
    } finally {
      clearTimeout(id);
    }
  }

  async function fetchYahooMeta(t: string) {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(t)}?range=1mo&interval=1d`;
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw new Error("fetch_failed");
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    const first = meta?.firstTradeDate ? new Date(meta.firstTradeDate * 1000) : null;
    return { firstTradeDate: first };
  }

  function parseUserDate(s?: string) {
    if (!s) return "";
    const m1 = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (m1) return `${m1[3]}-${m1[2]}-${m1[1]}`;
    const m2 = s.match(/^([0-9]{4})[/-]([0-9]{1,2})[/-]([0-9]{1,2})$/);
    if (m2) {
      const yyyy = m2[1];
      const mm = String(parseInt(m2[2], 10)).padStart(2, "0");
      const dd = String(parseInt(m2[3], 10)).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
    const m3 = s.match(/^([0-9]{1,2})\/([0-9]{1,2})\/([0-9]{4})$/);
    if (m3) {
      const a = parseInt(m3[1], 10);
      const b = parseInt(m3[2], 10);
      const yyyy = m3[3];
      const mm = String(a > 12 ? b : a).padStart(2, "0");
      const dd = String(a > 12 ? a : b).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
    return s;
  }

  async function normalizeRange(t: string, s?: string, e?: string) {
    const now = new Date();
    const sIso = parseUserDate(s) || "";
    const eIso = parseUserDate(e) || "";
    let sDate = sIso ? new Date(sIso) : null;
    let eDate = eIso ? new Date(eIso) : null;
    if (sDate && eDate && sDate > eDate) {
      const tmp = sDate; sDate = eDate; eDate = tmp;
    }
    let first: Date | null = null;
    try {
      const meta = await fetchYahooMeta(t);
      first = meta.firstTradeDate || null;
    } catch (err) {
      first = null;
    }
    if (!sDate) sDate = first || new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    if (!eDate) eDate = now;
    if (first && sDate < first) sDate = first;
    if (eDate > now) eDate = now;
    if (sDate > eDate) sDate = eDate;
    const sOut = sDate.toISOString().slice(0, 10);
    const eOut = eDate.toISOString().slice(0, 10);
    return { start: sOut, end: eOut };
  }

  const handlePredict = async () => {
    setIsProcessing(true);
    try {
      const tk = (ticker === "__custom__" ? customSymbol : ticker).trim() || "AAPL";
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("http://localhost:3002/predict-file", { method: "POST", body: fd });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        const pred = { direction: data.direction as "UP" | "DOWN", confidence: data.confidence as number };
        setPrediction(pred);
        addPrediction({ id: `${Date.now()}`, symbol: data.symbol, date: data.date || new Date().toISOString().slice(0, 10), direction: pred.direction, confidence: pred.confidence });
        toast.success("Prediction generated successfully!");
      } else {
        const norm = await normalizeRange(tk, startDate, endDate);
        const q = new URLSearchParams({ ticker: tk, start: norm.start, end: norm.end }).toString();
        const res = await fetchWithTimeout(`http://localhost:3002/predict?${q}`, {}, 8000);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        const pred = { direction: data.direction as "UP" | "DOWN", confidence: data.confidence as number };
        setPrediction(pred);
        setResultMeta({ symbol: (data.symbol || tk).toUpperCase(), date: data.date || new Date().toISOString().slice(0, 10), source: (data.source || ""), points: typeof data.points === "number" ? data.points : undefined });
        addPrediction({ id: `${Date.now()}`, symbol: data.symbol, date: data.date, direction: pred.direction, confidence: pred.confidence });
        toast.success("Prediction generated successfully!");
      }
    } catch {
      try {
        if (file) {
          const text = await file.text();
          const lines = text.trim().split(/\r?\n/);
          const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
          const idx = {
            date: header.findIndex((h) => h.includes("date")),
            close: header.findIndex((h) => h.includes("close")),
          };
          const closes: { date: string; close: number }[] = [];
          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(",");
            const d = cols[idx.date]?.trim();
            const c = Number(cols[idx.close]);
            if (d && !isNaN(c)) closes.push({ date: d, close: c });
          }
          if (!closes.length) throw new Error("no_data");
          const vals = closes.map((r) => r.close).slice(-500);
          const fp = fastPredict(vals);
          const dir = fp.dir;
          const conf = fp.conf;
          const pred = { direction: dir as "UP" | "DOWN", confidence: conf };
          setPrediction(pred);
          setResultMeta({ symbol: file.name, date: new Date().toISOString().slice(0, 10), source: "upload", points: closes.length });
          addPrediction({ id: `${Date.now()}`, symbol: file.name, date: new Date().toISOString().slice(0, 10), direction: pred.direction, confidence: pred.confidence });
          toast.success("Prediction generated successfully!");
        } else {
          const tk2 = (ticker === "__custom__" ? customSymbol : ticker).trim() || "AAPL";
          const norm2 = await normalizeRange(tk2, startDate, endDate);
          const res2 = await fetchWithTimeout(`http://localhost:3002/predict?${new URLSearchParams({ ticker: tk2, start: norm2.start, end: norm2.end }).toString()}`, {}, 8000);
          const data2 = await res2.json();
          if (!data2 || data2.error) {
            let data3 = await fetchYahoo(tk2, norm2.start, norm2.end);
            if (!data3.length) {
              data3 = await fetchStooqClient(tk2, norm2.start, norm2.end);
            }
            if (!data3.length) {
              data3 = await fetchYahooCsvClient(tk2, norm2.start, norm2.end);
            }
            if (!data3.length) throw new Error("no_data");
            const vals3 = data3.map((r) => r.close).slice(-500);
            const fp3 = fastPredict(vals3);
            const pred3 = { direction: fp3.dir as "UP" | "DOWN", confidence: fp3.conf };
            setPrediction(pred3);
            setResultMeta({ symbol: tk2.toUpperCase(), date: (data3[data3.length - 1]?.date || new Date().toISOString().slice(0, 10)), source: "client_fallback", points: data3.length });
            addPrediction({ id: `${Date.now()}`, symbol: tk2.toUpperCase(), date: (data3[data3.length - 1]?.date || new Date().toISOString().slice(0, 10)), direction: pred3.direction, confidence: pred3.confidence });
            toast.success("Prediction generated successfully!");
            return;
          }
          const pred = { direction: data2.direction as "UP" | "DOWN", confidence: data2.confidence as number };
          setPrediction(pred);
          setResultMeta({ symbol: (data2.symbol || tk2).toUpperCase(), date: data2.date || new Date().toISOString().slice(0, 10), source: (data2.source || ""), points: typeof data2.points === "number" ? data2.points : undefined });
          addPrediction({ id: `${Date.now()}`, symbol: (data2.symbol || tk2).toUpperCase(), date: data2.date || new Date().toISOString().slice(0, 10), direction: pred.direction, confidence: pred.confidence });
          toast.success("Prediction generated successfully!");
        }
      } catch {
        toast.error("Unable to generate prediction");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold mb-2">Market Predictions</h1>
        <p className="text-muted-foreground">
          Upload market data and get quantum-powered predictions
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 gradient-card border-primary/20 shadow-elevated">
          <h2 className="text-xl font-bold mb-6">Data Input</h2>
          
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Upload Market Data (CSV)</Label>
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  {file ? (
                    <p className="text-sm font-medium text-primary">{file.name}</p>
                  ) : (
                    <>
                      <p className="text-sm font-medium mb-1">Click to upload CSV</p>
                      <p className="text-xs text-muted-foreground">
                        Historical market data with OHLCV format
                      </p>
                    </>
                  )}
                </label>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ticker">Ticker</Label>
                <Select value={ticker} onValueChange={setTicker}>
                  <SelectTrigger id="ticker">
                    <SelectValue placeholder="Select a stock" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AAPL">AAPL</SelectItem>
                    <SelectItem value="MSFT">MSFT</SelectItem>
                    <SelectItem value="GOOG">GOOG</SelectItem>
                    <SelectItem value="AMZN">AMZN</SelectItem>
                    <SelectItem value="META">META</SelectItem>
                    <SelectItem value="TSLA">TSLA</SelectItem>
                    <SelectItem value="NVDA">NVDA</SelectItem>
                    <SelectItem value="SPY">SPY</SelectItem>
                    <SelectItem value="QQQ">QQQ</SelectItem>
                    <SelectItem value="TQQQ">TQQQ</SelectItem>
                    <SelectItem value="BTC-USD">BTC-USD</SelectItem>
                    <SelectItem value="ETH-USD">ETH-USD</SelectItem>
                    <SelectItem value="__custom__">Custom</SelectItem>
                  </SelectContent>
                </Select>
                {ticker === "__custom__" ? (
                  <Input placeholder="Enter symbol" value={customSymbol} onChange={(e) => setCustomSymbol(e.target.value)} />
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">End Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            <Button
              onClick={handlePredict}
              disabled={isProcessing}
              className="w-full gradient-quantum shadow-glow hover:shadow-elevated transition-all"
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                  Processing Quantum Model...
                </>
              ) : (
                "Train & Predict"
              )}
            </Button>
          </div>
        </Card>

        <Card className="p-6 gradient-card border-primary/20 shadow-elevated">
          <h2 className="text-xl font-bold mb-6">Prediction Result</h2>
          
          {prediction ? (
            <div className="space-y-6 animate-scale-in">
              <div className="text-center p-8 rounded-xl bg-muted/50 border-2 border-primary/30">
                <div
                  className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-4 ${
                    prediction.direction === "UP"
                      ? "bg-success/20 shadow-[0_0_30px_rgba(34,197,94,0.3)]"
                      : "bg-destructive/20 shadow-[0_0_30px_rgba(239,68,68,0.3)]"
                  }`}
                >
                  {prediction.direction === "UP" ? (
                    <TrendingUp className="w-10 h-10 text-success" />
                  ) : (
                    <TrendingDown className="w-10 h-10 text-destructive" />
                  )}
                </div>
                <h3 className="text-3xl font-bold mb-2">
                  {prediction.direction === "UP" ? "BULLISH" : "BEARISH"}
                </h3>
                <p className="text-muted-foreground mb-4">Market Direction</p>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-sm font-medium">
                    {prediction.confidence}% Confidence
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center p-4 rounded-lg bg-muted/30">
                  <span className="text-sm text-muted-foreground">Symbol</span>
                  <span className="font-semibold">{resultMeta?.symbol || ticker.toUpperCase()}</span>
                </div>
                <div className="flex justify-between items-center p-4 rounded-lg bg-muted/30">
                  <span className="text-sm text-muted-foreground">Date</span>
                  <span className="font-semibold">{resultMeta?.date || new Date().toISOString().slice(0, 10)}</span>
                </div>
                <div className="flex justify-between items-center p-4 rounded-lg bg-muted/30">
                  <span className="text-sm text-muted-foreground">Data Source</span>
                  <span className="font-semibold">{resultMeta?.source || ""}</span>
                </div>
                <div className="flex justify-between items-center p-4 rounded-lg bg-muted/30">
                  <span className="text-sm text-muted-foreground">Data Points</span>
                  <span className="font-semibold">{typeof resultMeta?.points === "number" ? resultMeta?.points : ""}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[400px] text-center">
              <div>
                <div className="w-16 h-16 mx-auto mb-4 rounded-full gradient-quantum opacity-50 animate-pulse" />
                <p className="text-muted-foreground">
                  Upload data and generate a prediction to see results
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Predict;
