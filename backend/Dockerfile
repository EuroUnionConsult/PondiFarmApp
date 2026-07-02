# PondiFarm API — imagem para Azure App Service (Container), Linux.
# Inclui o ODBC Driver 18 (msodbcsql18) pra falar com o Azure SQL.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1

# ODBC Driver 18 for SQL Server (repo oficial Microsoft) + unixodbc (runtime do pyodbc).
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl gnupg ca-certificates apt-transport-https unixodbc unixodbc-dev \
 && curl -fsSL https://packages.microsoft.com/keys/microsoft.asc \
        | gpg --dearmor -o /usr/share/keyrings/microsoft-prod.gpg \
 && curl -fsSL https://packages.microsoft.com/config/debian/12/prod.list \
        | sed 's|https://|[signed-by=/usr/share/keyrings/microsoft-prod.gpg] https://|' \
        > /etc/apt/sources.list.d/mssql-release.list \
 && apt-get update \
 && ACCEPT_EULA=Y apt-get install -y --no-install-recommends msodbcsql18 \
 && apt-get purge -y --auto-remove curl gnupg \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements-api.txt .
RUN pip install -r requirements-api.txt
COPY . .

# App Service injeta a porta via WEBSITES_PORT; default 8000.
ENV PORT=8000
EXPOSE 8000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
