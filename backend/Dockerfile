# ─── Multi-stage Dockerfile for all Spring Boot backend services ───
# Usage: docker build --build-arg SERVICE_NAME=user-management-service -t obs/user-management-service .

# ── Stage 1: Build ─────────────────────────────────────────────────
FROM eclipse-temurin:25-jdk-alpine AS builder

WORKDIR /build

# Copy Maven wrapper and parent pom first (cache dependencies)
COPY .mvn/ .mvn/
COPY mvnw mvnw.cmd pom.xml ./

# Copy all module pom.xml files for dependency resolution
COPY observability-shared/pom.xml observability-shared/pom.xml
COPY user-management-service/pom.xml user-management-service/pom.xml
COPY apm-service/pom.xml apm-service/pom.xml
COPY apm-report-service/pom.xml apm-report-service/pom.xml
COPY apm-ai-service/pom.xml apm-ai-service/pom.xml

# Download dependencies (cached unless pom.xml changes)
RUN chmod +x mvnw && ./mvnw dependency:go-offline -B -q 2>/dev/null || true

# Copy source code
COPY observability-shared/ observability-shared/
COPY user-management-service/ user-management-service/
COPY apm-service/ apm-service/
COPY apm-report-service/ apm-report-service/
COPY apm-ai-service/ apm-ai-service/

# Build: install parent POM + shared library, then package the target service
ARG SERVICE_NAME
RUN ./mvnw install -N -DskipTests -B -q && \
    ./mvnw install -pl observability-shared -DskipTests -B -q && \
    ./mvnw package -pl ${SERVICE_NAME} -DskipTests -B -q

# ── Stage 2: Runtime ───────────────────────────────────────────────
FROM eclipse-temurin:25-jre-alpine

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

ARG SERVICE_NAME
COPY --from=builder /build/${SERVICE_NAME}/target/${SERVICE_NAME}-1.0.0-SNAPSHOT.jar app.jar

RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 8080

ENV JAVA_OPTS="-Xms512m -Xmx1g"

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -Dspring.profiles.active=${SPRING_PROFILES_ACTIVE:-prod} -jar app.jar"]
