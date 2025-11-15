# Quantum VQC Market Predictor

A full-stack market direction predictor with quantum-enhanced inference. The app provides a clean Predictions UI, Charts visualization, and History, backed by a FastAPI server that fetches real OHLC data and produces predictions via a Variational Quantum Classifier (VQC) and an optional QLSTM/LSTM model.

## VQC: How It Works

- Input window
  - Takes the last N closing prices (window), normalizes to zero mean and unit variance.
  - The window size is configured via the quantum weights artifact; if absent, defaults are used.
- Encoding
  - Uses AngleEmbedding to map the normalized window into rotation angles on a set of qubits.
  - Reference: embedding setup in `server/app.py:65`.
- Ansatz / entanglement
  - Applies entangling layers across the wires to capture correlations in the encoded signal.
  - Reference: entangler layers in `server/app.py:66`.
- Measurement and readout
  - Measures the expectation value of `PauliZ` on wire 0 to produce a scalar `z` in `[-1, 1]`.
  - Maps to probability via `(z + 1) / 2` and converts to direction/confidence.
  - Reference: readout mapping in `server/app.py:71`–`73`.
- Inference flow
  - If a trained QLSTM/LSTM is available, it runs first; otherwise the VQC readout is used.
  - Reference: decision order in `server/app.py:58`–`91`.
- Why VQC
  - Compact learned feature transformation with entanglement, suitable for short windows and low latency.
  - Serves as a robust fallback when classical models are unavailable while retaining meaningful signal from recent prices.

## Highlights

- Robust data ingestion: yfinance → Yahoo Chart JSON → Stooq (with `.us` fallback)
- YFinance-like date normalization on the client (multiple formats, clamping, swap inverted ranges)
- Reliable predictions: server-first, with client fallbacks and local SMA inference when needed
- Interactive UI: ticker dropdown, custom symbol, date pickers, “Train & Predict” button
- Candlestick and volume charts powered by lightweight-charts
- Prediction metadata surfaced: symbol, date, data source, and data points

## Screenshots

Images are stored under `docs/images/`:

- `docs/images/Screenshot 2025-11-15 115940.png`
- `docs/images/Screenshot 2025-11-15 120059.png`
- `docs/images/Screenshot 2025-11-15 123730.png`

![Predict](docs/images/Screenshot%202025-11-15%20115940.png)

![Login](docs/images/Screenshot%202025-11-15%20120059.png)

![History](docs/images/Screenshot%202025-11-15%20123730.png)

## Quick Start

### Frontend

- Install dependencies: `npm install`
- Start dev server: `npm run dev`
- Open: `http://localhost:8081/`

### Backend

- Python venv recommended in `server/`
- Install backend deps: `pip install -r server/requirements.txt`
- Start API server: `uvicorn server.app:app --host 0.0.0.0 --port 3002`

### Endpoints

- `GET /predict?ticker=SYMBOL&start=YYYY-MM-DD&end=YYYY-MM-DD` — returns direction, confidence, symbol, date, source, points
- `POST /predict-file` — multipart CSV upload with a `close` column
- `GET /ohlc?ticker=SYMBOL&start=YYYY-MM-DD&end=YYYY-MM-DD` — returns `rows` with OHLCV

References:
- Predict endpoint: `server/app.py:93`
- Predict-file endpoint: `server/app.py:207`
- OHLC endpoint: `server/app.py:234`

## Architecture

- Frontend: Vite + React + shadcn UI + lightweight-charts
- Backend: FastAPI + Uvicorn
- Data sources: yfinance (direct), Yahoo Chart JSON, Stooq CSV
- ML/Quantum: TensorFlow Keras model loader and Pennylane quantum circuit

## Data Fetching and Normalization

- Client date parsing and normalization: `src/pages/Predict.tsx:213` and `src/pages/Predict.tsx:236`
- Backend data source priority:
  - yfinance download → `server/app.py:102`
  - Yahoo Chart JSON fallback → `server/app.py:124`
  - Stooq CSV fallback with `.us` alternative → `server/app.py:150`
- Charts data via backend `/ohlc` with multi-source logic: `server/app.py:234`

## Predictions Flow

- Primary path: Frontend requests backend `/predict` with normalized date range
- Fallbacks: If backend returns an error, the client attempts Yahoo JSON/CSV and Stooq CSV
- Ends in a local SMA prediction when upstream sources fail completely
- Prediction metadata saved with `symbol`, `date`, `source`, `points` for transparency

Key client logic:
- Final response handling and metadata: `src/pages/Predict.tsx:300`–`339`
- Ticker dropdown and custom symbol: `src/pages/Predict.tsx:391`–`413`
- Button label “Train & Predict”: `src/pages/Predict.tsx:454`

## Charts

- Fetch via backend to avoid browser CORS: `src/pages/Charts.tsx:146`
- Sanitization and time conversion for chart stability: `src/pages/Charts.tsx:104`, `src/pages/Charts.tsx:112`, `src/pages/Charts.tsx:118`
- Candlestick and histogram series setup with robust layout options: `src/pages/Charts.tsx:125`

## Variational Quantum Classifier (VQC)

- Implemented using Pennylane
- Circuit: AngleEmbedding of the last window of normalized closes; entangling layers; PauliZ expectation on wire 0
- Probability mapping: `(z + 1) / 2` → direction and confidence

Code reference:
- QNode and embedding: `server/app.py:63`
- Probability extraction and mapping: `server/app.py:71`–`73`

Usage:
- If QLSTM weights are unavailable or the model inference fails, the VQC provides a lightweight quantum readout from recent closes

## QLSTM/LSTM Model (Trained)

- The backend attempts to load a trained Keras LSTM from `lstm_model.keras`: `server/app.py:41`
- A quantum-LSTM configuration can be loaded from `qlstm_weights.npz`: `server/app.py:28`
- Sequence preparation for inference uses a fixed window (20 by default): `server/app.py:50`
- Inference priority: QLSTM → LSTM → SMA heuristic fallback

Training approach (high level):
- Data: Daily close series sourced via yfinance
- Preprocessing: Normalize window of recent closes; sliding window dataset
- Model: LSTM or QLSTM layers trained to classify UP/DOWN probability for next step
- Output: Binary probability mapped to direction and confidence

Note: The repository loads trained artifacts if present. If not found, it falls back to VQC or SMA.

## UI Details

- Predict page includes:
  - Ticker dropdown with common symbols and a Custom option: `src/pages/Predict.tsx:391`
  - Date pickers; multiple formats accepted and normalized
  - CSV upload for direct data inference
  - Prediction Result shows direction, confidence, symbol, date, data source, and data points: `src/pages/Predict.tsx:506`

- Charts page includes:
  - Fetch via backend `/ohlc` with date filtering and sanitization
  - Lightweight-charts series and responsive layout

## Development Scripts

- `npm run dev` — start frontend in dev mode
- `npm run lint` — run ESLint
- `npm run server` — convenience script to start backend (if defined in `package.json`)

## Troubleshooting

- Backend port in use: If `3001` is busy, use `3002` and update the frontend URLs in `src/pages/Predict.tsx` and `src/pages/Charts.tsx`
- File upload requires `python-multipart`; ensure it’s installed via `pip install -r server/requirements.txt`
- CORS issues in browser fetches are avoided by routing chart data through the backend `/ohlc`

## Security

- No secrets are committed; local venv and caches are ignored via `.gitignore`
- External requests are read-only; no trading actions performed