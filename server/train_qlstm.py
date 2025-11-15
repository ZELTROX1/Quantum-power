import os
import numpy as np
import yfinance as yf
import tensorflow as tf
import pennylane as qml
from datetime import datetime, timedelta

def fetch_closes(ticker, start, end):
    df = yf.download(ticker, start=start, end=end, progress=False)
    if df is None or df.empty:
        return []
    return [float(c) for c in df["Close"].dropna().values]

def make_dataset(closes, window=8):
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

def preprocess(seq):
    x = np.array(seq, dtype=np.float32)
    m = float(np.mean(x)); s = float(np.std(x))
    if s == 0:
        s = 1.0
    return (x - m) / s

def train(ticker="AAPL"):
    end = datetime.utcnow().date().isoformat()
    start = (datetime.utcnow().date() - timedelta(days=365*2)).isoformat()
    closes = fetch_closes(ticker, start, end)
    window = 8
    X, y = make_dataset(closes, window)
    X = np.array([preprocess(x) for x in X], dtype=np.float32)
    idx = np.arange(len(X))
    np.random.shuffle(idx)
    X = X[idx]; y = y[idx]
    split = int(len(X) * 0.8)
    Xtrain, ytrain = X[:split], y[:split]
    Xval, yval = X[split:], y[split:]

    wires = 4
    layers = 2
    dev = qml.device("default.qubit", wires=wires)

    @qml.qnode(dev, interface="tf")
    def circuit(inputs, weights):
        qml.AngleEmbedding(inputs[:wires], wires=range(wires))
        for l in range(layers):
            for w in range(wires):
                phi, theta, omega = weights[l, w]
                qml.Rot(phi, theta, omega, wires=w)
            for w in range(wires - 1):
                qml.CZ(wires=[w, w + 1])
            qml.CZ(wires=[wires - 1, 0])
        return qml.expval(qml.PauliZ(0))

    weights = tf.Variable(tf.random.normal([layers, wires, 3], stddev=0.1), trainable=True, dtype=tf.float32)
    opt = tf.keras.optimizers.Adam(0.01)
    loss_fn = tf.keras.losses.BinaryCrossentropy()

    def predict_prob(batch):
        probs = []
        for i in range(batch.shape[0]):
            z = circuit(batch[i], weights)
            p = (z + 1.0) / 2.0
            probs.append(p)
        return tf.stack(probs)

    for epoch in range(3):
        with tf.GradientTape() as tape:
            preds = predict_prob(tf.convert_to_tensor(Xtrain))
            loss = loss_fn(tf.convert_to_tensor(ytrain), tf.reshape(preds, (-1, 1)))
        grads = tape.gradient(loss, [weights])
        opt.apply_gradients(zip(grads, [weights]))

    out = os.path.join(os.path.dirname(os.path.dirname(__file__)), "qlstm_weights.npz")
    np.savez(out, weights=np.array(weights.numpy(), dtype=np.float32), window=np.array(window, dtype=np.int32), wires=np.array(wires, dtype=np.int32), layers=np.array(layers, dtype=np.int32))

if __name__ == "__main__":
    train()