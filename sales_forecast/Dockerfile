# MarketLens prediction API: the FastAPI server and its 34 models.
# Build for Google Cloud Run: docker build --platform linux/amd64 -t marketlens-api .
# Run locally:                docker run --rm -p 8080:8080 marketlens-api   (then open http://localhost:8080/docs)
FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    MARKETLENS_ROOT=/app

WORKDIR /app

COPY requirements-api.txt pyproject.toml ./
COPY src ./src
RUN pip install --no-cache-dir -r requirements-api.txt \
    && pip install --no-cache-dir --no-deps . \
    && rm -rf src pyproject.toml requirements-api.txt

COPY models/final ./models/final
COPY data/reference ./data/reference
COPY data/final/monthly_train.csv data/final/monthly_test.csv \
     data/final/yearly_train.csv data/final/yearly_test.csv data/final/yearly_2026_partial.csv \
     ./data/final/

RUN useradd --create-home appuser
USER appuser

EXPOSE 8080
# Cloud Run sets PORT; 8080 is the default elsewhere.
CMD ["sh", "-c", "exec python -m uvicorn marketlens.api.app:app --host 0.0.0.0 --port ${PORT:-8080}"]
