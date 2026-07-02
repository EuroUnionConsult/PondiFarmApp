# PondiFarm API — imagem para Azure App Service (Container), Linux.
# Inclui o ODBC Driver 18 (msodbcsql18) pra falar com o Azure SQL.
# IMPORTANTE: pinado em bookworm (Debian 12). O 'slim' virou trixie (Debian 13) e o
# pacote msodbcsql18 do repo debian/12 não instala o .so corretamente no 13.
FROM python:3.12-slim-bookworm

ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1

# ODBC Driver 18 for SQL Server (repo oficial Microsoft) + unixodbc (runtime do pyodbc).
# O prod.list da Microsoft (debian/12) já referencia signed-by=/usr/share/keyrings/microsoft-prod.gpg
# → só colocar a chave nesse caminho e copiar o prod.list COMO ESTÁ (não editar com sed).
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl gnupg ca-certificates apt-transport-https unixodbc unixodbc-dev \
 && curl -fsSL https://packages.microsoft.com/keys/microsoft.asc \
        | gpg --dearmor -o /usr/share/keyrings/microsoft-prod.gpg \
 && curl -fsSL https://packages.microsoft.com/config/debian/12/prod.list \
        -o /etc/apt/sources.list.d/mssql-release.list \
 && apt-get update \
 && ACCEPT_EULA=Y apt-get install -y --no-install-recommends msodbcsql18 \
 && rm -rf /var/lib/apt/lists/*

# Diagnóstico + verificação: mostra o driver registrado e garante que o .so existe.
RUN echo "=== odbcinst.ini ===" && cat /etc/odbcinst.ini \
 && echo "=== libs em /opt/microsoft/msodbcsql18 ===" && ls -lR /opt/microsoft/msodbcsql18/ \
 && odbcinst -q -d

WORKDIR /app
COPY requirements-api.txt .
RUN pip install -r requirements-api.txt
COPY . .

# App Service injeta a porta via WEBSITES_PORT; default 8000.
ENV PORT=8000
EXPOSE 8000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
