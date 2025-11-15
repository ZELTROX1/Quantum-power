export type Prediction = {
  id: string;
  symbol: string;
  date: string;
  direction: "UP" | "DOWN";
  confidence: number;
};

const KEY = "predictions";

export function getPredictions(): Prediction[] {
  const raw = localStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as Prediction[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function addPrediction(p: Prediction) {
  const arr = getPredictions();
  arr.unshift(p);
  localStorage.setItem(KEY, JSON.stringify(arr.slice(0, 1000)));
}