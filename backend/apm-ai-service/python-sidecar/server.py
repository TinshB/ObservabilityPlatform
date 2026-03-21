"""
Python ML Sidecar — gRPC server for AI/ML workloads.

This process runs alongside the Spring Boot apm-ai-service and handles
computationally intensive ML operations via gRPC.

Usage:
    1. pip install -r requirements.txt
    2. python generate_protos.py
    3. python server.py
"""

import sys
import time
import logging
from concurrent import futures
from pathlib import Path

import grpc

# Add generated stubs to path
sys.path.insert(0, str(Path(__file__).parent / "generated"))

import ml_service_pb2 as pb2
import ml_service_pb2_grpc as pb2_grpc

from services.anomaly_detection import detect as detect_anomalies
from services.forecasting import forecast as run_forecast
from services.error_diagnosis import diagnose as diagnose_errors

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("ml-sidecar")

START_TIME = time.time()


class MlServiceServicer(pb2_grpc.MlServiceServicer):
    """Implements the MlService gRPC interface."""

    def DetectAnomalies(self, request, context):
        start = time.time()
        logger.info(
            "DetectAnomalies: service=%s metric=%s points=%d algorithm=%s",
            request.service_name, request.metric_name,
            len(request.data_points), request.algorithm,
        )

        timestamps = [dp.timestamp_ms for dp in request.data_points]
        values = [dp.value for dp in request.data_points]

        anomalies = detect_anomalies(
            timestamps, values,
            sensitivity=request.sensitivity,
            algorithm=request.algorithm or "isolation_forest",
        )

        elapsed = (time.time() - start) * 1000
        logger.info("DetectAnomalies completed: %d anomalies in %.1fms", len(anomalies), elapsed)

        return pb2.AnomalyDetectionResponse(
            anomalies=[
                pb2.Anomaly(
                    timestamp_ms=a["timestamp_ms"],
                    value=a["value"],
                    score=a["score"],
                    expected_value=a["expected_value"],
                    lower_bound=a["lower_bound"],
                    upper_bound=a["upper_bound"],
                    severity=a["severity"],
                )
                for a in anomalies
            ],
            model_version="1.0.0",
            execution_time_ms=elapsed,
        )

    def AnalyzeRootCause(self, request, context):
        start = time.time()
        logger.info(
            "AnalyzeRootCause: service=%s window=[%d, %d]",
            request.service_name, request.incident_start_ms, request.incident_end_ms,
        )

        # Placeholder — real implementation would correlate metrics, logs, spans
        elapsed = (time.time() - start) * 1000
        return pb2.RootCauseResponse(
            causes=[
                pb2.RootCause(
                    service_name=request.service_name,
                    component="unknown",
                    description="Root cause analysis requires trained models. This is a scaffold response.",
                    probability=0.0,
                    evidence=["No ML models loaded yet"],
                ),
            ],
            analysis_summary="Scaffold response — ML models not yet trained.",
            confidence=0.0,
            execution_time_ms=elapsed,
        )

    def Forecast(self, request, context):
        start = time.time()
        logger.info(
            "Forecast: service=%s metric=%s points=%d horizon=%dmin algorithm=%s",
            request.service_name, request.metric_name,
            len(request.historical_data), request.forecast_horizon_minutes,
            request.algorithm,
        )

        timestamps = [dp.timestamp_ms for dp in request.historical_data]
        values = [dp.value for dp in request.historical_data]

        forecast_points = run_forecast(
            timestamps, values,
            horizon_minutes=request.forecast_horizon_minutes,
            algorithm=request.algorithm or "linear",
        )

        elapsed = (time.time() - start) * 1000
        logger.info("Forecast completed: %d points in %.1fms", len(forecast_points), elapsed)

        return pb2.ForecastResponse(
            forecast=[
                pb2.ForecastPoint(
                    timestamp_ms=fp["timestamp_ms"],
                    predicted_value=fp["predicted_value"],
                    lower_bound=fp["lower_bound"],
                    upper_bound=fp["upper_bound"],
                )
                for fp in forecast_points
            ],
            model_version="1.0.0",
            execution_time_ms=elapsed,
        )

    def DiagnoseErrors(self, request, context):
        start = time.time()
        logger.info(
            "DiagnoseErrors: trace=%s spans=%d logs=%d",
            request.trace_id, len(request.error_spans), len(request.associated_logs),
        )

        # Convert protobuf spans to plain dicts for the diagnosis service
        error_spans = []
        for es in request.error_spans:
            error_spans.append({
                "span_id": es.span_id,
                "service_name": es.service_name,
                "operation": es.operation,
                "duration_micros": es.duration_micros,
                "http_method": es.http_method,
                "http_url": es.http_url,
                "http_status_code": es.http_status_code,
                "tags": dict(es.tags),
                "error_logs": list(es.error_logs),
            })

        # Extract LLM config from the request (passed from Spring Boot application.yml)
        llm_cfg = request.llm_config if request.HasField("llm_config") else None

        result = diagnose_errors(
            trace_id=request.trace_id,
            error_spans=error_spans,
            associated_logs=list(request.associated_logs),
            language_hint=request.language_hint,
            llm_provider=llm_cfg.provider if llm_cfg else "",
            llm_api_key=llm_cfg.api_key if llm_cfg else "",
            llm_model=llm_cfg.model if llm_cfg else "",
        )

        elapsed = (time.time() - start) * 1000
        logger.info("DiagnoseErrors completed in %.1fms", elapsed)

        suggestions = []
        for s in result.get("suggestions", []):
            suggestions.append(pb2.ErrorFixSuggestion(
                span_id=s.get("span_id", ""),
                service_name=s.get("service_name", ""),
                error_type=s.get("error_type", ""),
                diagnosis=s.get("diagnosis", ""),
                suggested_fix=s.get("suggested_fix", ""),
                code_snippet=s.get("code_snippet", ""),
                severity=s.get("severity", "INFO"),
                references=s.get("references", []),
            ))

        return pb2.ErrorDiagnosisResponse(
            trace_id=request.trace_id,
            summary=result.get("summary", ""),
            suggestions=suggestions,
            confidence=result.get("confidence", 0.0),
            llm_model=result.get("llm_model", ""),
            execution_time_ms=elapsed,
        )

    def CheckHealth(self, request, context):
        return pb2.HealthCheckResponse(
            status="SERVING",
            python_version=f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
            loaded_models=["isolation_forest", "z_score", "linear_forecast", "rolling_forecast", "llm_error_diagnosis"],
            uptime_seconds=int(time.time() - START_TIME),
        )


def serve(port: int = 50051):
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    pb2_grpc.add_MlServiceServicer_to_server(MlServiceServicer(), server)
    server.add_insecure_port(f"[::]:{port}")
    server.start()
    logger.info("ML Sidecar gRPC server started on port %d", port)
    try:
        server.wait_for_termination()
    except KeyboardInterrupt:
        logger.info("Shutting down...")
        server.stop(grace=5)


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="ML Sidecar gRPC Server")
    parser.add_argument("--port", type=int, default=50051, help="gRPC listen port")
    args = parser.parse_args()
    serve(args.port)
