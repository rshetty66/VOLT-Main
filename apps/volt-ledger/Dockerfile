# VOLT Ledger: the private accounting service the VOLT Console calls. Built by render.yaml (service volt-ledger)
# with the repository root as the build context. It has no public URL: only the console reaches it.
FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY apps/volt-ledger/ ./
# Editable install keeps the package next to data/ontology, which it loads from its own folder.
RUN pip install --no-cache-dir -e . && mkdir -p /var/volt-ledger
ENV VOLT_LEDGER_DB=/var/volt-ledger/ledger.db PORT=8790
EXPOSE 8790
CMD ["python", "-m", "volt_ledger.api"]
