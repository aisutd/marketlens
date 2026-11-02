# MarketLens scoring API for Cloud Run (CPU only, one vCPU, one worker). Build context: the repo root,
# trimmed by .dockerignore / .gcloudignore to the files copied below.
FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    MODEL_DIR=models
ENV OMP_NUM_THREADS=1

WORKDIR /app

COPY api/requirements-api.txt api/requirements-api.txt
RUN pip install --no-cache-dir -r api/requirements-api.txt

# The training modules api/ imports (predict -> compare_models, improve_xgb, optional_features); none of
# them imports torch, transformers or sentence-transformers at module level.
COPY predict.py compare_models.py improve_xgb.py optional_features.py ./
COPY api/ api/
COPY models/embed_model.joblib models/reference_tables.joblib models/
COPY models/minilm-onnx/ models/minilm-onnx/

RUN useradd --no-create-home --uid 10001 app
USER app

CMD exec uvicorn api.app:app --host 0.0.0.0 --port ${PORT:-8080} --workers 1
