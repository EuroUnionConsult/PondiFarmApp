"""Benchmark: como tratar o sexo/categoria animal no modelo de peso.

A pergunta a que responde: o modelo base foi ajustado em 103 fêmeas Hereford e
os touros jovens são corrigidos por um fator multiplicativo (weightModel.ts,
BREED_CALIBRATIONS). Vale mais treinar com os machos do que corrigi-los por
fora?

Desenho: leave-one-series-out sobre as séries de testagem Limousine. Treina-se
em todas as séries menos uma e prevê-se a série excluída. Uma divisão aleatória
misturaria animais da mesma série no treino e no teste — é o mesmo motivo pelo
qual o benchmark_leave_one_series_out.py existe.

O fator multiplicativo é reajustado em cada dobra, nas séries de treino. Ajustá-
lo uma vez sobre tudo dava-lhe acesso à série de teste e inflava-o de graça.

Variáveis: as três que a coorte de fêmeas e a de machos medem ambas. A
profundidade torácica fica de fora porque nenhuma coorte de machos a mede —
imputá-la faria o código correr sobre uma coluna constante inventada.

    python backend/ml/training/benchmark_category_strategies.py
"""

from __future__ import annotations

import statistics
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from ml.training.benchmark_common import (  # noqa: E402
    ajustar,
    carregar,
    mape,
    matriz,
    numero,
    prever,
    verificar,
)

VARIAVEIS = ["chest_girth_cm", "withers_height_cm", "rump_width_cm"]

FEMEAS = "cowdatabase_hereford_103.csv"
MACHOS = "limousin_series_269.csv"

# Medido a 27/08/2026. Serve para detetar regressão, não como alvo a atingir.
ESPERADO = {
    "nulo": 8.16,
    "so_femeas": 5.24,
    "femeas_mais_fator": 3.56,
    "juntos": 3.17,
    "juntos_com_sexo": 3.24,
    "so_machos": 3.05,
}
TOLERANCIA = 0.25

ROTULOS = {
    "nulo": "preditor nulo (média dos machos de treino)",
    "so_femeas": "treinado só em fêmeas Hereford",
    "femeas_mais_fator": "fêmeas + fator multiplicativo (a app hoje)",
    "juntos": "fêmeas + machos juntos, sem variável de sexo",
    "juntos_com_sexo": "fêmeas + machos juntos, com variável de sexo",
    "so_machos": "treinado só em machos Limousine",
}


def desenho_com_sexo(linhas, variaveis):
    """Matriz com uma indicadora de macho — dá ao macho intercepto próprio."""
    desenho, alvo = matriz(linhas, variaveis)
    for indice, linha in enumerate(linhas):
        desenho[indice].append(1.0 if linha.get("sex") == "male" else 0.0)
    return desenho, alvo


def main() -> int:
    femeas = carregar(FEMEAS, VARIAVEIS)
    machos = carregar(MACHOS, VARIAVEIS, apenas_validados=True)
    print(f"Fêmeas Hereford: n={len(femeas)}   Machos Limousine: n={len(machos)}")
    print(f"Variáveis: {', '.join(v.removesuffix('_cm') for v in VARIAVEIS)}\n")

    series = sorted({linha["series"] for linha in machos}, key=int)
    resultados: dict[str, list[float]] = {chave: [] for chave in ESPERADO}
    usadas = []

    for serie in series:
        teste = [linha for linha in machos if linha["series"] == serie]
        treino = [linha for linha in machos if linha["series"] != serie]
        if len(teste) < 5 or len(treino) < 20:
            continue
        usadas.append((serie, len(teste)))

        desenho_teste, real = matriz(teste, VARIAVEIS)
        desenho_teste_sexo, _ = desenho_com_sexo(teste, VARIAVEIS)
        desenho_treino, alvo_treino = matriz(treino, VARIAVEIS)

        media_treino = statistics.fmean(alvo_treino)
        resultados["nulo"].append(mape(real, [media_treino] * len(real)))

        desenho_femeas, alvo_femeas = matriz(femeas, VARIAVEIS)
        coef_femeas = ajustar(desenho_femeas, alvo_femeas)
        base = prever(desenho_teste, coef_femeas)
        resultados["so_femeas"].append(mape(real, base))

        # Fator ajustado NAS SÉRIES DE TREINO, nunca na série de teste.
        base_treino = prever(desenho_treino, coef_femeas)
        fator = sum(alvo_treino) / sum(base_treino)
        resultados["femeas_mais_fator"].append(
            mape(real, [previsto * fator for previsto in base])
        )

        coef_machos = ajustar(desenho_treino, alvo_treino)
        resultados["so_machos"].append(mape(real, prever(desenho_teste, coef_machos)))

        desenho_juntos, alvo_juntos = matriz(femeas + treino, VARIAVEIS)
        resultados["juntos"].append(
            mape(real, prever(desenho_teste, ajustar(desenho_juntos, alvo_juntos)))
        )

        desenho_sexo, alvo_sexo = desenho_com_sexo(femeas + treino, VARIAVEIS)
        resultados["juntos_com_sexo"].append(
            mape(real, prever(desenho_teste_sexo, ajustar(desenho_sexo, alvo_sexo)))
        )

    animais = sum(n for _, n in usadas)
    print(f"Leave-one-series-out — {len(usadas)} séries, {animais} animais\n")

    codigo = 0
    for chave in (
        "nulo",
        "so_femeas",
        "femeas_mais_fator",
        "juntos",
        "juntos_com_sexo",
        "so_machos",
    ):
        medio = statistics.fmean(resultados[chave])
        print(f"  {ROTULOS[chave]:46s} MAPE {medio:5.2f}%")
    print()
    for chave, esperado in ESPERADO.items():
        codigo |= verificar(
            statistics.fmean(resultados[chave]), esperado, TOLERANCIA, ROTULOS[chave]
        )

    print("\nLeave-one-out nas fêmeas — juntar machos custa alguma coisa às fêmeas?")
    desenho_femeas, alvo_femeas = matriz(femeas, VARIAVEIS)
    desenho_machos, alvo_machos = matriz(machos, VARIAVEIS)
    for rotulo, extra_desenho, extra_alvo in (
        ("só fêmeas", [], []),
        ("fêmeas + machos", desenho_machos, alvo_machos),
    ):
        previstos = []
        for indice in range(len(alvo_femeas)):
            treino_desenho = [
                desenho_femeas[j] for j in range(len(alvo_femeas)) if j != indice
            ] + list(extra_desenho)
            treino_alvo = [
                alvo_femeas[j] for j in range(len(alvo_femeas)) if j != indice
            ] + list(extra_alvo)
            coeficientes = ajustar(treino_desenho, treino_alvo)
            previstos.append(
                sum(
                    desenho_femeas[indice][i] * coeficientes[i]
                    for i in range(len(coeficientes))
                )
            )
        print(f"  {rotulo:46s} MAPE {mape(alvo_femeas, previstos):5.2f}%")

    pesos = [numero(linha["real_weight_kg"]) for linha in femeas]
    print(
        f"\n  A coorte de fêmeas cobre {min(pesos):.0f}-{max(pesos):.0f} kg. "
        "É a amplitude, não o número de animais, que ensina forma->peso."
    )
    return codigo


if __name__ == "__main__":
    raise SystemExit(main())
