"""Anomaly detection using Isolation Forest and Z-Score."""

import time
import numpy as np
from sklearn.ensemble import IsolationForest


def detect_anomalies_isolation_forest(timestamps, values, sensitivity=0.5):
    """Detect anomalies using Isolation Forest."""
    if len(values) < 10:
        return []

    contamination = max(0.01, min(0.5, sensitivity * 0.3))
    X = np.array(values).reshape(-1, 1)

    model = IsolationForest(
        contamination=contamination,
        random_state=42,
        n_estimators=100,
    )
    model.fit(X)
    scores = model.decision_function(X)
    predictions = model.predict(X)

    # Normalize scores to [0, 1] where 1 = most anomalous
    score_min, score_max = scores.min(), scores.max()
    if score_max - score_min > 0:
        normalized = 1 - (scores - score_min) / (score_max - score_min)
    else:
        normalized = np.zeros_like(scores)

    # Compute rolling stats for expected value / bounds
    window = max(5, len(values) // 10)
    rolling_mean = np.convolve(values, np.ones(window) / window, mode="same")
    rolling_std = np.array([
        np.std(values[max(0, i - window):i + 1]) for i in range(len(values))
    ])

    anomalies = []
    for i in range(len(values)):
        if predictions[i] == -1:  # anomaly
            score = float(normalized[i])
            severity = "CRITICAL" if score > 0.8 else "WARNING" if score > 0.5 else "INFO"
            anomalies.append({
                "timestamp_ms": int(timestamps[i]),
                "value": float(values[i]),
                "score": score,
                "expected_value": float(rolling_mean[i]),
                "lower_bound": float(rolling_mean[i] - 2 * rolling_std[i]),
                "upper_bound": float(rolling_mean[i] + 2 * rolling_std[i]),
                "severity": severity,
            })

    return anomalies


def detect_anomalies_zscore(timestamps, values, sensitivity=0.5):
    """Detect anomalies using Z-Score method."""
    if len(values) < 5:
        return []

    arr = np.array(values, dtype=float)
    mean = np.mean(arr)
    std = np.std(arr)
    if std == 0:
        return []

    threshold = max(1.5, 4.0 - sensitivity * 2.5)
    z_scores = np.abs((arr - mean) / std)

    anomalies = []
    for i in range(len(values)):
        if z_scores[i] > threshold:
            score = min(1.0, float(z_scores[i]) / (threshold * 2))
            severity = "CRITICAL" if score > 0.8 else "WARNING" if score > 0.5 else "INFO"
            anomalies.append({
                "timestamp_ms": int(timestamps[i]),
                "value": float(values[i]),
                "score": score,
                "expected_value": float(mean),
                "lower_bound": float(mean - threshold * std),
                "upper_bound": float(mean + threshold * std),
                "severity": severity,
            })

    return anomalies


def detect(timestamps, values, sensitivity=0.5, algorithm="isolation_forest"):
    """Entry point — dispatches to the correct algorithm."""
    if algorithm == "z_score":
        return detect_anomalies_zscore(timestamps, values, sensitivity)
    return detect_anomalies_isolation_forest(timestamps, values, sensitivity)
