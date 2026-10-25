FROM python:3.12-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

FROM python:3.12-slim
WORKDIR /app
RUN useradd -m -u 1000 appuser
COPY --from=builder --chown=appuser:appuser /root/.local /home/appuser/.local
COPY --chown=appuser:appuser app/ ./app/
# SQL migrations, applied by `python -m app.db.migrate` (initContainer)
COPY --chown=appuser:appuser migrations/ ./migrations/
USER appuser
ENV PATH=/home/appuser/.local/bin:$PATH PYTHONPATH=/app
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:8000/health').raise_for_status()" || exit 1
# One replica only: live robot state and the Zenoh session are in memory.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
