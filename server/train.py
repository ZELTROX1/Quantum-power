import os
import requests
import numpy as np
from datetime import datetime, timedelta
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Dense, Dropout
from tensorflow.keras.optimizers import Adam

def fetch_closes(ticker, start, end):
    p1 = int(datetime.fromisoformat(start).timestamp())
    p2 = int(datetime.fromisoformat(end).timestamp())
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?period1={p1}&period2={p2}&interval=1d&includePrePost=false"
    r = requests.get(url)
    j = r.json()
    result = j.get("chart", {}).get("result", [{}])[0]
    closes = result.get("indicators", {}).get("quote", [{}])[0].get("close", [])
    return [c for c in closes if c is not None]

def make_dataset(closes, window=20):
    X = []
    y = []
    for i in range(len(closes) - window - 1):
        seq = closes[i:i+window]
        cur = closes[i+window]
        nxt = closes[i+window+1]
        X.append(seq)
        y.append(1 if nxt >= cur else 0)
    X = np.array(X, dtype=np.float32)
    y = np.array(y, dtype=np.float32).reshape(-1, 1)
    return X, y

def train(ticker="AAPL"):
    end = datetime.utcnow().date().isoformat()
    start = (datetime.utcnow().date() - timedelta(days=365*2)).isoformat()
    closes = fetch_closes(ticker, start, end)
    X, y = make_dataset(closes)
    split = int(len(X) * 0.8)
    Xtrain, ytrain = X[:split], y[:split]
    Xval, yval = X[split:], y[split:]
    model = Sequential()
    model.add(Dense(64, activation="relu", input_shape=(X.shape[1],)))
    model.add(Dropout(0.2))
    model.add(Dense(32, activation="relu"))
    model.add(Dense(1, activation="sigmoid"))
    model.compile(optimizer=Adam(0.001), loss="binary_crossentropy", metrics=["accuracy"])
    model.fit(Xtrain, ytrain, epochs=20, batch_size=32, validation_data=(Xval, yval), verbose=1)
    out = os.path.join(os.path.dirname(os.path.dirname(__file__)), "lstm_model.keras")
    model.save(out)

if __name__ == "__main__":
    train()