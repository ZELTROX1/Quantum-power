from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import io
import csv
import numpy as np
import requests
from tensorflow.keras.models import load_model
import pennylane as qml
import numpy as np
import yfinance as yf

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ROOT = os.path.dirname(os.path.dirname(__file__))
KERAS_PATH = os.path.join(ROOT, "lstm_model.keras")
QLSTM_WEIGHTS = os.path.join(ROOT, "qlstm_weights.npz")
model = None
qlstm_cfg = None
if os.path.exists(QLSTM_WEIGHTS):
    try:
        npz = np.load(QLSTM_WEIGHTS)
        qlstm_cfg = {
            "weights": npz["weights"],
            "window": int(npz["window"]),
            "wires": int(npz["wires"]),
            "layers": int(npz["layers"]),
        }
    except Exception:
        qlstm_cfg = None
elif os.path.exists(KERAS_PATH):
    try:
        model = load_model(KERAS_PATH)
    except Exception:
        model = None

class PredictQuery(BaseModel):
    ticker: str
    start: str
    end: str

def make_sequences(vals, window=20):
    if len(vals) < window:
        return None
    seq = np.array(vals[-window:], dtype=np.float32)
    return seq.reshape(1, window, 1)

def infer_from_closes(closes):
    arr = np.array(closes, dtype=np.float32)
    if qlstm_cfg is not None:
        try:
            wires = qlstm_cfg["wires"]
            window = qlstm_cfg["window"]
            dev = qml.device("default.qubit", wires=wires)
            @qml.qnode(dev)
            def circuit(inputs, weights):
                qml.AngleEmbedding(inputs[:wires], wires=range(wires))
                qml.BasicEntanglerLayers(weights, wires=range(wires))
                return qml.expval(qml.PauliZ(0))
            seq = np.array(arr[-window:], dtype=np.float32)
            m = float(np.mean(seq)); s = float(np.std(seq)); s = s if s != 0 else 1.0
            seq = (seq - m) / s
            z = circuit(seq, qlstm_cfg["weights"])
            prob = float((z + 1.0) / 2.0)
            return {"direction": "UP" if prob >= 0.5 else "DOWN", "confidence": int(round(prob * 100))}
        except Exception:
            pass
    if model is not None:
        try:
            x = make_sequences(arr.tolist())
            if x is not None:
                prob = float(model.predict(x, verbose=0)[0][0])
                return {"direction": "UP" if prob >= 0.5 else "DOWN", "confidence": int(round(prob * 100))}
        except Exception:
            pass
    s = arr.astype(np.float32)
    if len(s) < 20:
        return {"direction": "DOWN", "confidence": 50}
    sma = float(np.mean(s[-20:]))
    last = float(s[-1])
    direction = "UP" if last > sma else "DOWN"
    confidence = int(round(min(95, max(55, abs((last - sma) / sma) * 100))))
    return {"direction": direction, "confidence": confidence}

@app.get("/predict")
def predict(ticker: str, start: str = "", end: str = ""):
    from datetime import datetime, timedelta
    try:
        if not end:
            end = datetime.utcnow().date().isoformat()
        if not start:
            start = (datetime.utcnow().date() - timedelta(days=365)).isoformat()
        try:
            df = yf.download(ticker, start=start, end=end, progress=False)
        except Exception:
            df = None
        closes = None
        last_date = ""
        source = ""
        if df is not None and not df.empty:
            closes = df["Close"].dropna().values
            try:
                last_date = str(df.index[-1].date())
            except Exception:
                last_date = end
            source = "yfinance"
        if closes is None or len(closes) == 0:
            try:
                # Yahoo Chart JSON fallback
                s_dt = datetime.fromisoformat(start)
                e_dt = datetime.fromisoformat(end)
                if s_dt > e_dt:
                    s_dt, e_dt = e_dt, s_dt
                p1 = int(s_dt.timestamp())
                p2 = int(e_dt.timestamp())
                url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?period1={p1}&period2={p2}&interval=1d&includePrePost=false"
                r = requests.get(url, timeout=10, headers={"User-Agent": "Mozilla/5.0"}, verify=False)
                if r.status_code == 200:
                    j = r.json()
                    result = (j.get("chart", {}).get("result") or [None])[0]
                    ts = (result or {}).get("timestamp") or []
                    q = ((result or {}).get("indicators") or {}).get("quote") or []
                    q0 = (q or [None])[0] or {}
                    c = q0.get("close") or []
                    arr = []
                    for i in range(min(len(ts), len(c))):
                        try:
                            if c[i] is None:
                                continue
                            arr.append(float(c[i]))
                            last_date = datetime.utcfromtimestamp(int(ts[i])).date().isoformat()
                        except Exception:
                            continue
                    if arr:
                        closes = np.array(arr, dtype=np.float32)
                        source = "yahoo_chart"
            except Exception:
                pass
        if closes is None or len(closes) == 0:
            import csv
            import io
            def _stooq_fetch(sym):
                u = f"https://stooq.com/q/d/l/?s={sym}&i=d"
                resp = requests.get(u, timeout=10, headers={"User-Agent": "Mozilla/5.0"}, verify=False)
                if resp.status_code != 200:
                    return None, ""
                t = resp.text.strip()
                rs = list(csv.reader(io.StringIO(t)))
                if len(rs) <= 1:
                    return None, ""
                hdr = [h.strip().lower() for h in rs[0]]
                try:
                    i_date = hdr.index("date")
                    i_close = hdr.index("close")
                except ValueError:
                    return None, ""
                flt = []
                s_dt = datetime.fromisoformat(start)
                e_dt = datetime.fromisoformat(end)
                if s_dt > e_dt:
                    s_dt, e_dt = e_dt, s_dt
                ld = ""
                for rr in rs[1:]:
                    try:
                        d = datetime.fromisoformat(rr[i_date])
                        c = float(rr[i_close])
                    except Exception:
                        continue
                    if d >= s_dt and d <= e_dt:
                        flt.append(c)
                        ld = d.date().isoformat()
                if not flt:
                    return None, ""
                return np.array(flt, dtype=np.float32), ld
            c1, ld1 = _stooq_fetch(ticker.lower())
            if c1 is None or len(c1) == 0:
                c2, ld2 = _stooq_fetch(f"{ticker.lower()}.us")
                if c2 is not None and len(c2) > 0:
                    closes = c2
                    last_date = ld2
                    source = "stooq"
                else:
                    closes = None
            else:
                closes = c1
                last_date = ld1
                source = "stooq"
        if closes is None or len(closes) == 0:
            return {"error": "no_data"}
        closes = np.array(closes, dtype=np.float32)
        if len(closes) > 500:
            closes = closes[-500:]
        res = infer_from_closes(closes)
        res.update({"symbol": ticker.upper(), "date": last_date or end, "source": source or "", "points": int(len(closes))})
        return res
    except Exception:
        return {"direction": "DOWN", "confidence": 50, "symbol": ticker.upper(), "date": end or "", "source": "", "points": 0}

@app.post("/predict-file")
async def predict_file(file: UploadFile = File(...)):
    content = await file.read()
    f = io.StringIO(content.decode("utf-8"))
    reader = csv.reader(f)
    rows = list(reader)
    header = [h.strip().lower() for h in rows[0]] if rows else []
    try:
        idx = header.index("close")
    except ValueError:
        try:
            idx = header.index("adj close")
        except ValueError:
            return {"error": "no_close_column"}
    closes = []
    for r in rows[1:]:
        try:
            closes.append(float(r[idx]))
        except Exception:
            continue
    if not closes:
        return {"error": "no_data"}
    res = infer_from_closes(np.array(closes))
    res.update({"symbol": file.filename, "date": ""})
    return res

def pd_timestamp(date_str):
    from datetime import datetime
    return datetime.fromisoformat(date_str).timestamp()

@app.get("/ohlc")
def ohlc(ticker: str, start: str = "", end: str = ""):
    from datetime import datetime, timedelta
    try:
        if not end:
            end = datetime.utcnow().date().isoformat()
        if not start:
            start = (datetime.utcnow().date() - timedelta(days=365)).isoformat()
        try:
            df = yf.download(ticker, start=start, end=end, progress=False)
        except Exception:
            df = None
        rows = []
        if df is not None and not df.empty:
            for idx, r in df.iterrows():
                try:
                    d = str(idx.date())
                    o = float(r["Open"]) if r["Open"] == r["Open"] else None
                    h = float(r["High"]) if r["High"] == r["High"] else None
                    l = float(r["Low"]) if r["Low"] == r["Low"] else None
                    c = float(r["Close"]) if r["Close"] == r["Close"] else None
                    v = int(r["Volume"]) if r["Volume"] == r["Volume"] else 0
                    if None not in (o, h, l, c):
                        rows.append({"time": d, "open": o, "high": h, "low": l, "close": c, "volume": v})
                except Exception:
                    continue
        if not rows:
            s_dt = datetime.fromisoformat(start)
            e_dt = datetime.fromisoformat(end)
            if s_dt > e_dt:
                s_dt, e_dt = e_dt, s_dt
            p1 = int(s_dt.timestamp())
            p2 = int(e_dt.timestamp())
            url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?period1={p1}&period2={p2}&interval=1d&includePrePost=false"
            r = requests.get(url, timeout=10, headers={"User-Agent": "Mozilla/5.0"}, verify=False)
            if r.status_code == 200:
                j = r.json()
                result = (j.get("chart", {}).get("result") or [None])[0]
                ts = (result or {}).get("timestamp") or []
                q = ((result or {}).get("indicators") or {}).get("quote") or []
                q0 = (q or [None])[0] or {}
                opens = q0.get("open") or []
                highs = q0.get("high") or []
                lows = q0.get("low") or []
                closes = q0.get("close") or []
                vols = q0.get("volume") or []
                for i in range(min(len(ts), len(closes))):
                    try:
                        d = datetime.utcfromtimestamp(int(ts[i])).date().isoformat()
                        o = opens[i]; h = highs[i]; l = lows[i]; c = closes[i]; v = vols[i] or 0
                        if None not in (o, h, l, c):
                            rows.append({"time": d, "open": float(o), "high": float(h), "low": float(l), "close": float(c), "volume": int(v)})
                    except Exception:
                        continue
        if not rows:
            u = f"https://stooq.com/q/d/l/?s={ticker.lower()}&i=d"
            resp = requests.get(u, timeout=10, headers={"User-Agent": "Mozilla/5.0"}, verify=False)
            if resp.status_code == 200:
                t = resp.text.strip()
                rs = list(csv.reader(io.StringIO(t)))
                hdr = [h.strip().lower() for h in rs[0]] if rs else []
                try:
                    i_date = hdr.index("date"); i_open = hdr.index("open"); i_high = hdr.index("high"); i_low = hdr.index("low"); i_close = hdr.index("close"); i_vol = hdr.index("volume")
                    for rr in rs[1:]:
                        try:
                            d = rr[i_date]; o = float(rr[i_open]); h = float(rr[i_high]); l = float(rr[i_low]); c = float(rr[i_close]); v = int(float(rr[i_vol])) if i_vol < len(rr) else 0
                            rows.append({"time": d, "open": o, "high": h, "low": l, "close": c, "volume": v})
                        except Exception:
                            continue
                except Exception:
                    pass
            if not rows:
                u2 = f"https://stooq.com/q/d/l/?s={ticker.lower()}.us&i=d"
                resp2 = requests.get(u2, timeout=10, headers={"User-Agent": "Mozilla/5.0"}, verify=False)
                if resp2.status_code == 200:
                    t2 = resp2.text.strip()
                    rs2 = list(csv.reader(io.StringIO(t2)))
                    hdr2 = [h.strip().lower() for h in rs2[0]] if rs2 else []
                    try:
                        i_date = hdr2.index("date"); i_open = hdr2.index("open"); i_high = hdr2.index("high"); i_low = hdr2.index("low"); i_close = hdr2.index("close"); i_vol = hdr2.index("volume")
                        for rr in rs2[1:]:
                            try:
                                d = rr[i_date]; o = float(rr[i_open]); h = float(rr[i_high]); l = float(rr[i_low]); c = float(rr[i_close]); v = int(float(rr[i_vol])) if i_vol < len(rr) else 0
                                rows.append({"time": d, "open": o, "high": h, "low": l, "close": c, "volume": v})
                            except Exception:
                                continue
                    except Exception:
                        pass
        if not rows:
            return {"error": "no_data", "rows": []}
        s_dt = datetime.fromisoformat(start)
        e_dt = datetime.fromisoformat(end)
        if s_dt > e_dt:
            s_dt, e_dt = e_dt, s_dt
        filt = [r for r in rows if s_dt <= datetime.fromisoformat(r["time"]) <= e_dt]
        return {"rows": filt if filt else rows}
    except Exception:
        return {"error": "service_unavailable", "rows": []}