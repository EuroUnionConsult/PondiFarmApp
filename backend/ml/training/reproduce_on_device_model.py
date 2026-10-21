"""Reproduz, a partir dos CSV normalizados, os coeficientes exatos que estão
embutidos em mobile/src/lib/weightModel.ts.

Correr a partir da raiz do repositório:

    python backend/ml/training/reproduce_on_device_model.py

Falha com código diferente de zero se os números do código deixarem de bater
com os dados. É esse o objetivo: se alguém alterar os CSV ou os coeficientes
sem alterar o outro lado, isto denuncia.

Sem dependências além do numpy — a regressão é resolvida por mínimos quadrados
diretos, o mesmo que o LinearRegression do scikit-learn faz.
"""

from __future__ import annotations

import csv
import sys
from pathlib import Path

import numpy as np

RAIZ = Path(__file__).resolve().parents[3]
PROCESSADOS = RAIZ / "backend" / "ml" / "datasets" / "processed"

VERSAO = "external-trained-v0.2.0"
# A ordem TEM de coincidir com o COEF de mobile/src/lib/weightModel.ts
VARIAVEIS = [
    "withers_height_cm",
    "thoracic_depth_cm",
    "rump_width_cm",
    "chest_girth_cm",
]

# O que está no dispositivo, copiado à letra.
COEF_NO_DISPOSITIVO = [
    1.6451018341024197,
    0.3620137862529025,
    5.488782242499486,
    3.7381253276099202,
]
INTERCEPT_NO_DISPOSITIVO = -691.191945913401
MEDIANAS_NO_DISPOSITIVO = [120.0, 62.0, 44.0, 180.0]
FATOR_LIMOUSINE_NO_DISPOSITIVO = 1.2608


def ler(nome: str) -> list[dict[str, str]]:
    caminho = PROCESSADOS / nome
    if not caminho.exists():
        sys.exit(
            f"Falta {caminho}.\n"
            "Os CSV normalizados não são versionados por serem derivados; "
            "gere-os a partir das fontes públicas antes de correr isto."
        )
    with caminho.open() as f:
        return list(csv.DictReader(f))


def matriz(linhas, variaveis):
    X = np.array([[float(r[v]) for v in variaveis] for r in linhas])
    y = np.array([float(r["real_weight_kg"]) for r in linhas])
    return X, y


def ajustar(X, y):
    A = np.column_stack([np.ones(len(X)), X])
    return np.linalg.lstsq(A, y, rcond=None)[0]


def loocv(X, y):
    A = np.column_stack([np.ones(len(X)), X])
    previsto = np.empty(len(y))
    for i in range(len(y)):
        m = np.ones(len(y), bool)
        m[i] = False
        previsto[i] = A[i] @ np.linalg.lstsq(A[m], y[m], rcond=None)[0]
    return previsto


def mape(real, previsto):
    return 100 * float(np.mean(np.abs(previsto - real) / real))


def main() -> int:
    hereford = ler("cowdatabase_hereford_103.csv")
    X, y = matriz(hereford, VARIAVEIS)
    coef = ajustar(X, y)
    medianas = [float(np.median(X[:, i])) for i in range(X.shape[1])]

    print(f"Modelo {VERSAO} — treinado em {len(y)} Hereford (CowDatabase)")
    print(f"  INTERCEPT {coef[0]!r}")
    print(f"  COEF      {[float(v) for v in coef[1:]]}")
    print(f"  MEDIAN    {medianas}")

    previsto = loocv(X, y)
    nulo = np.array([float(np.mean(np.delete(y, i))) for i in range(len(y))])
    print(
        f"\n  LOOCV  MAPE {mape(y, previsto):.2f}%   MAE {np.mean(np.abs(previsto - y)):.1f} kg"
        f"   r {np.corrcoef(previsto, y)[0, 1]:.3f}"
    )
    print(f"  NULO   MAPE {mape(y, nulo):.2f}%   <- a comparação obrigatória")

    # Fator Limousine sobre esta base, com imputação pelas medianas de treino
    # para as variáveis que a ACL não mede.
    acl = ler("acl_limousine_15.csv")
    F = np.tile(np.array(medianas), (len(acl), 1))
    for k, r in enumerate(acl):
        F[k, 0] = float(r["withers_height_cm"])
        F[k, 2] = float(r["rump_width_cm"])
        F[k, 3] = float(r["chest_girth_cm"])
    base = coef[0] + F @ coef[1:]
    real = np.array([float(r["real_weight_kg"]) for r in acl])
    fator = float(np.mean(real / base))

    corrigido = np.empty(len(real))
    for i in range(len(real)):
        m = np.ones(len(real), bool)
        m[i] = False
        corrigido[i] = base[i] * float(np.mean(real[m] / base[m]))
    nulo_acl = np.array([float(np.mean(np.delete(real, i))) for i in range(len(real))])
    print(f"\n  Limousine ACL (n={len(real)}): fator x{fator:.4f}")
    print(
        f"    sem correção {mape(real, base):.2f}%  ->  com fator {mape(real, corrigido):.2f}% (LOOCV)"
    )
    print(
        f"    NULO {mape(real, nulo_acl):.2f}%  -> ganho {mape(real, nulo_acl) - mape(real, corrigido):+.2f} pp, "
        "que a n=15 é ruído e nunca deve ser citado como validação"
    )

    print("\nConferência com mobile/src/lib/weightModel.ts")
    erros = []
    for nome, obtido, esperado, tol in (
        ("INTERCEPT", [coef[0]], [INTERCEPT_NO_DISPOSITIVO], 1e-9),
        ("COEF", list(coef[1:]), COEF_NO_DISPOSITIVO, 1e-9),
        ("MEDIAN", medianas, MEDIANAS_NO_DISPOSITIVO, 1e-9),
        ("fator Limousine", [fator], [FATOR_LIMOUSINE_NO_DISPOSITIVO], 5e-5),
    ):
        ok = len(obtido) == len(esperado) and all(
            abs(a - b) <= tol for a, b in zip(obtido, esperado)
        )
        print(f"  {'✅' if ok else '❌'} {nome}")
        if not ok:
            erros.append(f"{nome}: dados dão {obtido}, o dispositivo tem {esperado}")

    if erros:
        print("\nDIVERGÊNCIA — o modelo no dispositivo já não corresponde aos dados:")
        for e in erros:
            print("  " + e)
        return 1
    print("\nO que corre no telemóvel é exatamente o que estes dados produzem.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
