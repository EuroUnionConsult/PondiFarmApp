"""Benchmark de referência: treinar em todas as séries menos uma, prever a série
excluída.

É este o desenho de validação correcto quando as observações estão agrupadas —
aqui por série de testagem e por centro. Uma divisão aleatória mistura animais da
mesma série no treino e no teste e devolve um número optimista que não diz nada
sobre o comportamento numa exploração nova.

Passa a ser o critério interno: qualquer versão da pipeline 3D é avaliada contra
ele, na mesma população e com o mesmo protocolo. Deixamos de comparar com números
da literatura obtidos noutras condições.

    python backend/ml/training/benchmark_leave_one_series_out.py
"""

from __future__ import annotations

import csv
import sys
from pathlib import Path

import numpy as np

RAIZ = Path(__file__).resolve().parents[3]
DADOS = RAIZ / "backend" / "ml" / "datasets" / "processed" / "limousin_series_269.csv"

# Referência publicada pelo coordenador na v5 da base, para detectar regressão.
MAPE_ESPERADO = 3.04
TOLERANCIA = 0.25


def ler():
    if not DADOS.exists():
        sys.exit(f"Falta {DADOS}. Gere-o com normalize_limousin_series.py.")
    with DADOS.open() as f:
        return list(csv.DictReader(f))


def numero(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def ajustar(X, y):
    return np.linalg.lstsq(X, y, rcond=None)[0]


def mape(real, previsto):
    return 100 * float(np.mean(np.abs(previsto - real) / real))


def matriz(registos, variaveis):
    X = np.column_stack(
        [np.ones(len(registos))] + [[numero(r[v]) for r in registos] for v in variaveis]
    )
    y = np.array([numero(r["real_weight_kg"]) for r in registos], float)
    return X, y


def completos(registos, variaveis, so_validados=True):
    saida = []
    for r in registos:
        if so_validados and str(r["validated_subset"]).lower() not in (
            "1",
            "true",
            "sim",
            "si",
            "yes",
            "vero",
        ):
            continue
        if numero(r["real_weight_kg"]) is None:
            continue
        if any(numero(r[v]) is None for v in variaveis):
            continue
        saida.append(r)
    return saida


def leave_one_series_out(registos, variaveis):
    series = sorted({r["series"] for r in registos}, key=int)
    linhas, todos_reais, todos_previstos = [], [], []
    for s in series:
        teste = [r for r in registos if r["series"] == s]
        treino = [r for r in registos if r["series"] != s]
        if len(teste) < 5 or len(treino) < 20:
            continue
        Xtr, ytr = matriz(treino, variaveis)
        Xte, yte = matriz(teste, variaveis)
        prev = Xte @ ajustar(Xtr, ytr)
        linhas.append(
            (
                s,
                len(yte),
                mape(yte, prev),
                float(np.mean(np.abs(prev - yte))),
                float(np.max(np.abs(prev - yte))),
            )
        )
        todos_reais.append(yte)
        todos_previstos.append(prev)
    real = np.concatenate(todos_reais)
    previsto = np.concatenate(todos_previstos)
    return linhas, real, previsto


def leave_one_out(registos, variaveis):
    X, y = matriz(registos, variaveis)
    prev = np.empty(len(y))
    for i in range(len(y)):
        m = np.ones(len(y), bool)
        m[i] = False
        prev[i] = X[i] @ ajustar(X[m], y[m])
    return prev, y


def main() -> int:
    registos = ler()
    VARIAVEIS = ["chest_girth_cm", "withers_height_cm", "body_length_cm"]
    dados = completos(registos, VARIAVEIS)
    print(f"Leave-one-series-out — {len(dados)} animais no subconjunto validado")
    print(f"Variáveis: {', '.join(VARIAVEIS)}\n")

    linhas, real, previsto = leave_one_series_out(dados, VARIAVEIS)
    print(f"{'série':>7s} {'n':>5s} {'MAPE':>8s} {'MAE':>9s} {'erro máx':>10s}")
    for s, n, mp, mae, mx in linhas:
        print(f"{s:>7s} {n:5d} {mp:7.2f}% {mae:8.1f}kg {mx:9.1f}kg")
    medio = float(np.mean([linha[2] for linha in linhas]))
    print(
        f"{'MÉDIA':>7s} {len(real):5d} {medio:7.2f}% "
        f"{float(np.mean(np.abs(previsto - real))):8.1f}kg "
        f"{float(np.max(np.abs(previsto - real))):9.1f}kg"
    )

    nulo = np.array([float(np.mean(np.delete(real, i))) for i in range(len(real))])
    print(
        f"\n  preditor nulo (média da coorte): {mape(real, nulo):.2f}%   <- a comparação obrigatória"
    )

    # Comparação de conjuntos de variáveis NO MESMO subconjunto. A tabela de
    # benchmarks da v5 compara-os em subconjuntos diferentes, o que atribui às
    # medidas extra um ganho que vem do conjunto ter mudado.
    print("\n  Mesmo subconjunto, variáveis diferentes (leave-one-out):")
    for variaveis in (
        ["chest_girth_cm"],
        ["chest_girth_cm", "withers_height_cm"],
        VARIAVEIS,
        VARIAVEIS + ["chest_width_cm", "rump_width_cm"],
    ):
        sub = completos(registos, VARIAVEIS + ["chest_width_cm", "rump_width_cm"])
        prev, y = leave_one_out(sub, variaveis)
        print(
            f"    {'+'.join(v.replace('_cm', '') for v in variaveis):58s} {mape(y, prev):5.2f}%  n={len(y)}"
        )

    desvio = abs(medio - MAPE_ESPERADO)
    if desvio > TOLERANCIA:
        print(
            f"\n❌ MAPE médio {medio:.2f}% difere do esperado {MAPE_ESPERADO}% em {desvio:.2f} pp"
        )
        return 1
    print(
        f"\n✅ MAPE médio {medio:.2f}% dentro de {TOLERANCIA} pp do esperado ({MAPE_ESPERADO}%)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
