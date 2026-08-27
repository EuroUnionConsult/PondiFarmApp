"""Benchmark: as medidas de LiDAR aéreo contêm sinal de peso?

Coorte Simmental de Wang et al. 2024 — touros jovens sobrevoados por UAV com
LiDAR, com peso de balança emparelhado. É a única coorte pública onde as medidas
vêm de 3D e não de fita, e por isso a candidata natural a pré-treinar a cadeia
forma-3D -> peso.

Este benchmark existe para responder antes de investir: vale a pena descarregar
as nuvens completas (26,5 GB) e correr o extrator sobre elas?

Duas armadilhas que o desenho evita:

1. São 95 registos mas 45 animais — o mesmo animal é sobrevoado em até três
   campanhas. A validação é leave-one-ANIMAL-out: sai o animal inteiro, não a
   linha. Por linha, o mesmo animal fica no treino e no teste e o número deixa
   de significar nada.

2. O preditor nulo é obrigatório. Com sete variáveis e 45 animais é fácil um
   modelo parecer bom sem explicar nada, e a coorte tem CV de peso de 9,9%.

    python backend/ml/training/benchmark_lidar_signal.py
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
    verificar,
)

FICHEIRO = "simmental_uav_lidar_95.csv"

TODAS = [
    "abdominal_width_cm",
    "abdominal_width_2_cm",
    "hip_height_cm",
    "withers_height_cm",
    "wih_cm",
    "bh_cm",
    "body_length_cm",
]

CONJUNTOS = [
    (["withers_height_cm"], "só altura à cernelha"),
    (["withers_height_cm", "body_length_cm"], "cernelha + comprimento"),
    (
        ["withers_height_cm", "hip_height_cm", "body_length_cm"],
        "cernelha + garupa + comprimento",
    ),
    (
        ["abdominal_width_cm", "withers_height_cm", "hip_height_cm", "body_length_cm"],
        "largura abdominal + 3 medidas",
    ),
    (TODAS, "as 7 do LiDAR"),
]

# Medido a 27/08/2026.
ESPERADO_MELHOR = 6.70
ESPERADO_NULO = 8.13
TOLERANCIA = 0.30


def leave_one_animal_out(linhas, variaveis):
    """Prevê cada linha com um modelo que nunca viu NENHUMA linha desse animal."""
    desenho, alvo = matriz(linhas, variaveis)
    identidades = [linha["external_animal_id"] for linha in linhas]
    previstos = []
    for indice in range(len(alvo)):
        manter = [j for j in range(len(alvo)) if identidades[j] != identidades[indice]]
        coeficientes = ajustar([desenho[j] for j in manter], [alvo[j] for j in manter])
        previstos.append(
            sum(desenho[indice][i] * coeficientes[i] for i in range(len(coeficientes)))
        )
    return alvo, previstos


def nulo_por_animal(linhas):
    """Média dos OUTROS animais — não das outras linhas."""
    alvo = [numero(linha["real_weight_kg"]) for linha in linhas]
    identidades = [linha["external_animal_id"] for linha in linhas]
    previstos = [
        statistics.fmean(
            alvo[j] for j in range(len(alvo)) if identidades[j] != identidades[indice]
        )
        for indice in range(len(alvo))
    ]
    return mape(alvo, previstos)


def repetibilidade(linhas):
    """Dispersão da MESMA medida no mesmo animal, entre voos, contra a dispersão
    entre animais.

    É o teste que diz se um descritor mede o animal ou mede o ruído da captura.
    Se o desvio dentro do animal se aproxima do desvio entre animais, a variável
    não consegue distinguir um animal do outro — por muito modelo que se lhe
    ponha em cima.
    """
    por_animal = {}
    for linha in linhas:
        por_animal.setdefault(linha["external_animal_id"], []).append(linha)
    repetidos = [v for v in por_animal.values() if len(v) > 1]

    print(f"\nRepetibilidade — {len(repetidos)} animais com mais de um voo:\n")
    print(f"  {'descritor':24s} {'DP dentro':>10s} {'DP entre':>10s} {'razão':>8s}")
    for descritor in TODAS:
        dentro = statistics.fmean(
            statistics.pstdev([numero(linha[descritor]) for linha in grupo])
            for grupo in repetidos
        )
        entre = statistics.pstdev(
            statistics.fmean([numero(linha[descritor]) for linha in grupo])
            for grupo in por_animal.values()
        )
        print(
            f"  {descritor.removesuffix('_cm'):24s} {dentro:9.2f}cm "
            f"{entre:9.2f}cm {dentro / entre:7.2f}x"
        )
    print(
        "\n  O comprimento corporal tem ruído de captura quase do tamanho da\n"
        "  variação real entre animais. Não distingue um animal do outro."
    )

    pesos_por_animal = {
        identidade: {linha["real_weight_kg"] for linha in grupo}
        for identidade, grupo in por_animal.items()
    }
    if all(len(pesos) == 1 for pesos in pesos_por_animal.values()):
        print(
            "\n  O peso é constante entre voos do mesmo animal. Por isso a\n"
            "  validação por identidade não é só prudente, é obrigatória: sair\n"
            "  uma linha deixaria o alvo exacto visível noutra linha do treino."
        )


def main() -> int:
    linhas = carregar(FICHEIRO, TODAS)
    animais = {linha["external_animal_id"] for linha in linhas}
    pesos = [numero(linha["real_weight_kg"]) for linha in linhas]
    coeficiente_variacao = 100 * statistics.pstdev(pesos) / statistics.fmean(pesos)

    print(f"Simmental UAV-LiDAR: {len(linhas)} registos, {len(animais)} animais")
    print(
        f"Peso {min(pesos):.0f}-{max(pesos):.0f} kg, CV {coeficiente_variacao:.2f}%\n"
    )
    print("Leave-one-ANIMAL-out:\n")

    melhor = None
    for variaveis, rotulo in CONJUNTOS:
        alvo, previstos = leave_one_animal_out(linhas, variaveis)
        resultado = mape(alvo, previstos)
        melhor = resultado if melhor is None else min(melhor, resultado)
        print(f"  {rotulo:34s} MAPE {resultado:5.2f}%")

    nulo = nulo_por_animal(linhas)
    print(f"  {'preditor nulo':34s} MAPE {nulo:5.2f}%")
    print(f"\n  Melhor conjunto ganha {nulo - melhor:.2f} pp ao preditor nulo.")

    repetibilidade(linhas)

    print(
        "\n  Interpretação. O perímetro torácico é a variável mais preditiva\n"
        "  deste problema — sozinha faz 3,79% na coorte Limousine por fita. O\n"
        "  LiDAR aéreo vê o animal de cima e não fecha uma circunferência, por\n"
        "  isso não a mede. O que sobra são larguras, alturas e comprimento.\n"
        "  Comparação de referência: por fita, na Limousine, o modelo faz 3,05%\n"
        "  contra um nulo de 8,16% — cinco pontos de ganho, não um.\n"
        "\n  Conclusão operacional: esta coorte não serve para pré-treinar\n"
        "  forma->peso. Continua a servir para testar a EXTRAÇÃO de medidas a\n"
        "  partir de nuvens, que é outra coisa e não depende de haver sinal de\n"
        "  peso nos descritores."
    )

    print()
    codigo = verificar(melhor, ESPERADO_MELHOR, TOLERANCIA, "melhor conjunto")
    codigo |= verificar(nulo, ESPERADO_NULO, TOLERANCIA, "preditor nulo")
    return codigo


if __name__ == "__main__":
    raise SystemExit(main())
