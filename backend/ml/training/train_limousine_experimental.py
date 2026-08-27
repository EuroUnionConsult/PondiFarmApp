"""Modelo Limousine EXPERIMENTAL — touros jovens, morfometria de fita.

Separado do modelo que a aplicação usa, de propósito. Não substitui nada, não
escreve por cima de nenhum artefacto de produção e os seus coeficientes não
entram no weightModel.ts. Existe para respondermos a uma pergunta concreta:
dentro das séries de testagem espanholas, quanto vale ajustar directamente à
raça em vez de corrigir o modelo Hereford por um fator.

O QUE ESTE MODELO NÃO DEMONSTRA

Fica no ficheiro, e não só num documento, porque um artefacto de modelo viaja
para fora do contexto em que foi criado.

  Portugal          A transferência para a coorte da ACL dá 15,53% e nenhuma
                    correcção de escala bate o preditor nulo. As duas fontes
                    contradizem-se: os animais da ACL medem menos em perímetro
                    e em cernelha, e pesam mais. Ver
                    benchmark_cross_cohort_transfer.py.
  Vacas adultas     A população é 100% machos, touros jovens pré-seleccionados.
                    Zero fêmeas. Aplicar isto a uma vaca não tem base nenhuma.
  Scans de iPhone   Todas as medidas de treino são de fita métrica. A cadeia
                    automática mede quantidades geometricamente análogas mas
                    não idênticas, e essa diferença ainda não foi quantificada
                    em animais com scan e balança emparelhados. Não existe hoje
                    um único animal nessas condições.

Correr a partir da raiz do repositório:
    python backend/ml/training/train_limousine_experimental.py
"""

from __future__ import annotations

import json
import statistics
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from ml.training.benchmark_common import (  # noqa: E402
    ajustar,
    carregar,
    mape,
    mape_do_nulo,
    matriz,
    prever,
)

COORTE = "limousin_series_269.csv"

# As três que a base espanhola mede em todas as séries validadas. A
# profundidade torácica não entra porque a base não a tem em nenhum animal —
# imputá-la seria treinar sobre uma coluna constante inventada.
VARIAVEIS = ["chest_girth_cm", "withers_height_cm", "rump_width_cm"]

SAIDA = (
    Path(__file__).resolve().parents[1]
    / "models"
    / "weight"
    / "limousine-young-bull-experimental-v0.1.0.json"
)


def leave_one_series_out(linhas):
    """MAPE por série excluída, e os coeficientes ajustados em todas menos uma.

    Uma divisão aleatória misturaria animais da mesma série no treino e no
    teste. Séries inteiras é o agrupamento real destes dados.
    """
    series = sorted({linha["series"] for linha in linhas}, key=int)
    por_serie = []
    for serie in series:
        teste = [linha for linha in linhas if linha["series"] == serie]
        treino = [linha for linha in linhas if linha["series"] != serie]
        if len(teste) < 5 or len(treino) < 20:
            continue
        desenho_treino, alvo_treino = matriz(treino, VARIAVEIS)
        desenho_teste, alvo_teste = matriz(teste, VARIAVEIS)
        coeficientes = ajustar(desenho_treino, alvo_treino)
        por_serie.append(
            (
                serie,
                len(alvo_teste),
                mape(alvo_teste, prever(desenho_teste, coeficientes)),
            )
        )
    return por_serie


def main() -> int:
    linhas = carregar(COORTE, VARIAVEIS, apenas_validados=True)
    desenho, alvo = matriz(linhas, VARIAVEIS)
    coeficientes = ajustar(desenho, alvo)

    print(
        f"Limousine experimental — {len(linhas)} touros jovens do subconjunto validado"
    )
    print(f"Variáveis: {', '.join(v.removesuffix('_cm') for v in VARIAVEIS)}\n")

    por_serie = leave_one_series_out(linhas)
    print(f"  {'série':>7s} {'n':>5s} {'MAPE':>8s}")
    for serie, n, resultado in por_serie:
        print(f"  {serie:>7s} {n:5d} {resultado:7.2f}%")
    medio = statistics.fmean(resultado for _, _, resultado in por_serie)
    nulo = mape_do_nulo(alvo)
    print(f"  {'MÉDIA':>7s} {sum(n for _, n, _ in por_serie):5d} {medio:7.2f}%")
    print(f"\n  preditor nulo: {nulo:.2f}%   ganho: {nulo - medio:.2f} pp")

    artefacto = {
        "model_id": "limousine-young-bull-experimental-v0.1.0",
        "status": "experimental",
        "supersedes_nothing": True,
        "feature_names": VARIAVEIS,
        "intercept": coeficientes[0],
        "coefficients": dict(zip(VARIAVEIS, coeficientes[1:])),
        "trained_on": {
            "cohort": COORTE,
            "n_animals": len(linhas),
            "population": "entire males, young bulls, Spanish performance-test stations",
            "measurement_method": "tape morphometry",
        },
        "leave_one_series_out_mape_percent": round(medio, 2),
        "null_predictor_mape_percent": round(nulo, 2),
        "validated_for": [],
        "NOT_validated_for": [
            "Portuguese animals — transfer to the ACL cohort scores 15.53% and "
            "no scale correction beats the null predictor",
            "adult cows — the training population contains zero females",
            "iPhone LiDAR scans — every training measurement is tape-derived, "
            "and no animal exists with a paired scan and scale weight",
        ],
        "do_not_embed_in_app": True,
    }

    SAIDA.parent.mkdir(parents=True, exist_ok=True)
    with SAIDA.open("w") as ficheiro:
        json.dump(artefacto, ficheiro, indent=2)
        ficheiro.write("\n")

    print(f"\n  Escrito: {SAIDA.relative_to(Path(__file__).resolve().parents[3])}")
    print("  Marcado como experimental. Não embeber na aplicação.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
