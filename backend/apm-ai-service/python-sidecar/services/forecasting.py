"""Simple time-series forecasting (linear regression and rolling average)."""

import numpy as np


def forecast_linear(timestamps, values, horizon_minutes=60):
    """Forecast using linear regression."""
    if len(values) < 2:
        return []

    ts = np.array(timestamps, dtype=float)
    vals = np.array(values, dtype=float)

    # Fit linear regression
    coeffs = np.polyfit(ts, vals, deg=1)
    slope, intercept = coeffs

    # Calculate residual std for confidence bounds
    predicted = np.polyval(coeffs, ts)
    residual_std = np.std(vals - predicted)

    # Generate future timestamps
    last_ts = ts[-1]
    interval = np.median(np.diff(ts)) if len(ts) > 1 else 60000
    n_steps = max(1, int((horizon_minutes * 60 * 1000) / interval))

    forecast = []
    for i in range(1, n_steps + 1):
        future_ts = last_ts + i * interval
        pred = slope * future_ts + intercept
        forecast.append({
            "timestamp_ms": int(future_ts),
            "predicted_value": float(pred),
            "lower_bound": float(pred - 2 * residual_std),
            "upper_bound": float(pred + 2 * residual_std),
        })

    return forecast


def forecast_rolling(timestamps, values, horizon_minutes=60):
    """Forecast using rolling average with trend."""
    if len(values) < 3:
        return []

    vals = np.array(values, dtype=float)
    ts = np.array(timestamps, dtype=float)

    window = min(len(vals), max(3, len(vals) // 4))
    rolling_mean = np.mean(vals[-window:])
    rolling_std = np.std(vals[-window:])

    # Simple trend from last window
    if len(vals) >= window * 2:
        prev_mean = np.mean(vals[-window * 2:-window])
        trend_per_step = (rolling_mean - prev_mean) / window
    else:
        trend_per_step = 0

    interval = np.median(np.diff(ts)) if len(ts) > 1 else 60000
    n_steps = max(1, int((horizon_minutes * 60 * 1000) / interval))
    last_ts = ts[-1]

    forecast = []
    for i in range(1, n_steps + 1):
        future_ts = last_ts + i * interval
        pred = rolling_mean + trend_per_step * i
        forecast.append({
            "timestamp_ms": int(future_ts),
            "predicted_value": float(pred),
            "lower_bound": float(pred - 2 * rolling_std),
            "upper_bound": float(pred + 2 * rolling_std),
        })

    return forecast


def forecast(timestamps, values, horizon_minutes=60, algorithm="linear"):
    """Entry point — dispatches to the correct algorithm."""
    if algorithm == "linear":
        return forecast_linear(timestamps, values, horizon_minutes)
    return forecast_rolling(timestamps, values, horizon_minutes)
