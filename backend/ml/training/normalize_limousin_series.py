"""Normaliza a base Limousin v5 (269 touros, centros de testagem espanhóis) para
o CSV interno, acrescentando as colunas de que o protocolo leave-one-series-out
precisa: a série e o marcador de qualidade.

Correr a partir da raiz do repositório:
    python backend/ml/training/normalize_limousin_series.py <caminho-do-xlsx>

A fonte é um XLSX auditado e não é versionada — o CSV derivado é, porque sem ele
o benchmark deixa de ser reprodutível.
"""

from __future__ import annotations

import csv
import sys
from pathlib import Path

import openpyxl

RAIZ = Path(__file__).resolve().parents[3]
SAIDA = RAIZ / "backend" / "ml" / "datasets" / "processed" / "limousin_series_269.csv"

COLUNAS = [
    "dataset_source",
    "external_animal_id",
    "series",
    "center",
    "breed",
    "sex",
    "age_days",
    "body_length_cm",
    "withers_height_cm",
    "thoracic_depth_cm",
    "rump_width_cm",
    "chest_girth_cm",
    "chest_width_cm",
    "real_weight_kg",
    "qc_flag",
    "validated_subset",
    "notes",
]


def numero(valor):
    try:
        return float(valor)
    except (TypeError, ValueError):
        return ""


def main() -> int:
    origem = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    if origem is None or not origem.exists():
        sys.exit(
            "Indique o caminho para Limousin_Biometric_Public_Web_Dataset_v5.xlsx.\n"
            "A fonte não é versionada; o CSV derivado é."
        )

    livro = openpyxl.load_workbook(origem, read_only=True, data_only=True)
    linhas = list(livro["Final_Biometrics"].iter_rows(values_only=True))
    indice = {nome: i for i, nome in enumerate(linhas[0]) if nome}

    registos = []
    for linha in linhas[1:]:
        if not linha[indice["animal_id"]]:
            continue
        marcador = str(linha[indice["qc_flag"]] or "")
        registos.append(
            {
                "dataset_source": "FECL/LIMUSINEX-ES",
                "external_animal_id": linha[indice["animal_id"]],
                "series": linha[indice["series"]],
                "center": linha[indice["center"]],
                "breed": "Limousine",
                "sex": "male",
                "age_days": numero(linha[indice["age_days"]]),
                # A base espanhola não mede profundidade torácica.
                "body_length_cm": numero(linha[indice["body_length_cm"]]),
                "withers_height_cm": numero(linha[indice["withers_height_cm"]]),
                "thoracic_depth_cm": "",
                "rump_width_cm": numero(linha[indice["rump_width_cm"]]),
                "chest_girth_cm": numero(linha[indice["thoracic_girth_cm"]]),
                "chest_width_cm": numero(linha[indice["chest_width_cm"]]),
                "real_weight_kg": numero(linha[indice["weight_kg"]]),
                "qc_flag": marcador,
                "validated_subset": linha[indice["validated_subset"]],
                "notes": "young bulls, station performance test; tape morphometry",
            }
        )

    SAIDA.parent.mkdir(parents=True, exist_ok=True)
    with SAIDA.open("w", newline="") as ficheiro:
        escritor = csv.DictWriter(ficheiro, fieldnames=COLUNAS)
        escritor.writeheader()
        escritor.writerows(registos)

    series = sorted({str(r["series"]) for r in registos}, key=int)
    print(f"{SAIDA.name}: {len(registos)} animais, {len(series)} séries")
    print(f"  séries: {', '.join(series)}")
    marcados = sum(1 for r in registos if r["qc_flag"] and r["qc_flag"] != "ok")
    print(f"  com marcador de qualidade: {marcados}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
