"""Benchmark: um modelo treinado numa coorte serve noutra?

É a pergunta que decide se um número de validação diz alguma coisa sobre uma
exploração nova. O leave-one-series-out da base espanhola dá 3,04%, mas mede
generalização DENTRO da mesma população e do mesmo protocolo de medição. Este
benchmark mede a outra coisa: treinar numa coorte e prever outra, adquirida por
outra gente, noutro país.

Duas transferências interessam:

1. Entre categorias (fêmeas adultas <-> touros jovens). Responde a "vale a pena
   migrar o modelo base de Hereford para Limousine?".
2. Entre coortes da MESMA raça e MESMA categoria (Limousine ES -> Limousine PT).
   Responde a "o 3,04% atravessa para os nossos animais?".

Variáveis: perímetro torácico e altura à cernelha — o único par que as quatro
coortes medem. Um conjunto maior compararia coortes diferentes em subconjuntos
diferentes e atribuiria à transferência um efeito que vinha da amostra ter
mudado.

    python backend/ml/training/benchmark_cross_cohort_transfer.py
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
    mape_do_nulo,
    matriz,
    numero,
    prever,
    verificar,
)

VARIAVEIS = ["chest_girth_cm", "withers_height_cm"]

# Medido a 27/08/2026.
ESPERADO = {
    "hereford_para_angus": 8.92,
    "limousine_para_angus": 23.19,
    "hereford_para_limousine": 9.30,
    "limousine_para_acl": 15.53,
}
TOLERANCIA = 0.30


def coeficientes(linhas):
    desenho, alvo = matriz(linhas, VARIAVEIS)
    return ajustar(desenho, alvo)


def aplicar(coefs, linhas):
    desenho, alvo = matriz(linhas, VARIAVEIS)
    return alvo, prever(desenho, coefs)


def media(linhas, coluna):
    return statistics.fmean(numero(linha[coluna]) for linha in linhas)


def main() -> int:
    hereford = carregar("cowdatabase_hereford_103.csv", VARIAVEIS)
    angus = carregar("cowdatabase2_angus_96.csv", VARIAVEIS)
    limousine = carregar("limousin_series_269.csv", VARIAVEIS, apenas_validados=True)
    acl = carregar("acl_limousine_15.csv", VARIAVEIS)

    print(f"Variáveis: {', '.join(v.removesuffix('_cm') for v in VARIAVEIS)}\n")
    for rotulo, linhas in (
        ("Hereford (fêmeas adultas)", hereford),
        ("Angus (fêmeas adultas)", angus),
        ("Limousine ES (touros jovens)", limousine),
        ("ACL PT (touros jovens)", acl),
    ):
        pesos = [numero(linha["real_weight_kg"]) for linha in linhas]
        print(
            f"  {rotulo:30s} n={len(linhas):3d}  "
            f"{statistics.fmean(pesos):5.0f} kg ({min(pesos):.0f}-{max(pesos):.0f})"
        )

    coef_hereford = coeficientes(hereford)
    coef_limousine = coeficientes(limousine)
    obtido = {}

    print("\n1) PREVER FÊMEAS ADULTAS")
    print("   É o que são as vacas da sessão de campo (530-868 kg).")
    real, previsto = aplicar(coef_hereford, angus)
    obtido["hereford_para_angus"] = mape(real, previsto)
    print(
        f"   treinado em Hereford (fêmeas)   -> Angus  MAPE {obtido['hereford_para_angus']:6.2f}%"
    )
    real, previsto_limousine = aplicar(coef_limousine, angus)
    obtido["limousine_para_angus"] = mape(real, previsto_limousine)
    print(
        f"   treinado em Limousine (machos)  -> Angus  MAPE {obtido['limousine_para_angus']:6.2f}%"
    )

    fator = sum(real) / sum(previsto_limousine)
    corrigido = mape(real, [p * fator for p in previsto_limousine])
    nulo_angus = mape_do_nulo(real)
    print(f"   Limousine x fator {fator:.3f}                    MAPE {corrigido:6.2f}%")
    print(f"   preditor nulo                             MAPE {nulo_angus:6.2f}%")
    if corrigido >= nulo_angus:
        print(
            "   ^ o fator foi ajustado no PRÓPRIO teste e mesmo assim não bate o\n"
            "     nulo: a base de machos não explica fêmeas, corrige-se ou não."
        )

    print("\n2) PREVER TOUROS JOVENS")
    real, previsto = aplicar(coef_hereford, limousine)
    obtido["hereford_para_limousine"] = mape(real, previsto)
    print(
        f"   treinado em Hereford  -> Limousine ES     MAPE {obtido['hereford_para_limousine']:6.2f}%"
    )

    print("\n3) MESMA RAÇA, MESMA CATEGORIA, FONTE DIFERENTE")
    print("   Limousine ES -> ACL PT. É a transferência que a app precisa mesmo.")
    real, previsto = aplicar(coef_limousine, acl)
    obtido["limousine_para_acl"] = mape(real, previsto)
    print(f"   sem correção          MAPE {obtido['limousine_para_acl']:6.2f}%")
    fator_acl = sum(real) / sum(previsto)
    print(
        f"   x fator {fator_acl:.3f}          "
        f"MAPE {mape(real, [p * fator_acl for p in previsto]):6.2f}%"
    )
    desvio = statistics.fmean(r - p for r, p in zip(real, previsto))
    print(
        f"   + desvio {desvio:+.0f} kg       "
        f"MAPE {mape(real, [p + desvio for p in previsto]):6.2f}%"
    )
    print(f"   preditor nulo         MAPE {mape_do_nulo(real):6.2f}%  <- nada o bate")

    print("\n   Porquê. As médias das duas coortes contradizem-se:")
    print(f"   {'':16s} {'perímetro':>10s} {'cernelha':>10s} {'peso':>8s}")
    for rotulo, linhas in (("Limousine ES", limousine), ("ACL PT", acl)):
        print(
            f"   {rotulo:16s} {media(linhas, 'chest_girth_cm'):9.1f}cm "
            f"{media(linhas, 'withers_height_cm'):9.1f}cm "
            f"{media(linhas, 'real_weight_kg'):7.0f}kg"
        )
    print(
        "   Os animais da ACL medem menos em ambas as dimensões e pesam mais.\n"
        "   Isso não é biologia — é convenção de medição diferente entre as\n"
        "   fontes. Enquanto não for resolvido, coeficientes ajustados numa não\n"
        "   devem ser aplicados à outra."
    )

    print()
    codigo = 0
    for chave, esperado in ESPERADO.items():
        codigo |= verificar(obtido[chave], esperado, TOLERANCIA, chave)
    return codigo


if __name__ == "__main__":
    raise SystemExit(main())
