"""Peças partilhadas pelos benchmarks: mínimos quadrados, métricas e carga dos
CSV normalizados.

Porquê sem numpy. O benchmark_leave_one_series_out.py usa-o e continua a usar,
mas estes três benchmarks correm com a biblioteca-padrão de propósito: um
resultado que só se reproduz depois de montar um ambiente é um resultado que na
prática ninguém volta a correr. Com stdlib basta `python3 <ficheiro>` em
qualquer máquina, e os conjuntos aqui em causa têm 15 a 269 linhas — a
diferença de desempenho não existe a esta escala.

O ajuste é por equações normais com eliminação de Gauss e pivotagem parcial.
Para 2 a 7 variáveis e centenas de linhas é numericamente adequado; para
matrizes mal condicionadas ou muitas variáveis deixaria de ser, e nesse caso o
caminho certo é numpy.linalg.lstsq, não remendar isto.
"""

from __future__ import annotations

import csv
import statistics
from pathlib import Path
from typing import Iterable, Optional, Sequence

PROCESSADOS = Path(__file__).resolve().parents[1] / "datasets" / "processed"

# Valores que o subconjunto validado da base espanhola usa para dizer "sim".
MARCAS_VALIDADO = ("1", "true", "sim", "si", "yes", "vero")


def numero(valor: Optional[str]) -> Optional[float]:
    """Converte para float. Devolve None em vazio, texto ou valor não positivo.

    Uma medida corporal ou um peso de zero ou negativo é sempre erro de
    extração, nunca um animal.
    """
    try:
        convertido = float(str(valor).strip().replace(",", "."))
    except (TypeError, ValueError):
        return None
    return convertido if convertido > 0 else None


def carregar(
    nome_ficheiro: str,
    variaveis: Sequence[str],
    apenas_validados: bool = False,
) -> list[dict[str, str]]:
    """Linhas com peso e TODAS as variáveis pedidas presentes.

    Descartar a linha inteira é deliberado. A alternativa — imputar a mediana —
    faz o código correr sobre uma coluna que a coorte nunca mediu e produz um
    modelo que parece ter aprendido algo que não existe no dado.
    """
    caminho = PROCESSADOS / nome_ficheiro
    if not caminho.exists():
        raise SystemExit(f"Falta {caminho}. Gere-o com o normalizador respetivo.")

    linhas = []
    for linha in csv.DictReader(caminho.open()):
        if apenas_validados:
            if str(linha.get("validated_subset", "")).lower() not in MARCAS_VALIDADO:
                continue
        if numero(linha.get("real_weight_kg")) is None:
            continue
        if any(numero(linha.get(variavel)) is None for variavel in variaveis):
            continue
        linhas.append(linha)
    return linhas


def matriz(
    linhas: Iterable[dict[str, str]],
    variaveis: Sequence[str],
) -> tuple[list[list[float]], list[float]]:
    """Matriz de desenho com termo constante, e o vetor de pesos reais."""
    linhas = list(linhas)
    desenho = [
        [1.0] + [numero(linha[variavel]) for variavel in variaveis] for linha in linhas
    ]
    alvo = [numero(linha["real_weight_kg"]) for linha in linhas]
    return desenho, alvo


def resolver(
    matriz_quadrada: list[list[float]],
    termos: list[float],
) -> Optional[list[float]]:
    """Eliminação de Gauss-Jordan com pivotagem parcial. None se for singular."""
    ordem = len(matriz_quadrada)
    aumentada = [
        linha[:] + [termos[indice]] for indice, linha in enumerate(matriz_quadrada)
    ]
    for coluna in range(ordem):
        pivo = max(range(coluna, ordem), key=lambda i: abs(aumentada[i][coluna]))
        if abs(aumentada[pivo][coluna]) < 1e-12:
            return None
        aumentada[coluna], aumentada[pivo] = aumentada[pivo], aumentada[coluna]
        for indice in range(ordem):
            if indice == coluna:
                continue
            fator = aumentada[indice][coluna] / aumentada[coluna][coluna]
            for k in range(coluna, ordem + 1):
                aumentada[indice][k] -= fator * aumentada[coluna][k]
    return [aumentada[i][ordem] / aumentada[i][i] for i in range(ordem)]


def ajustar(
    desenho: list[list[float]],
    alvo: list[float],
) -> Optional[list[float]]:
    """Coeficientes de mínimos quadrados de `alvo` sobre `desenho`."""
    largura = len(desenho[0])
    normal = [
        [
            sum(desenho[i][a] * desenho[i][b] for i in range(len(desenho)))
            for b in range(largura)
        ]
        for a in range(largura)
    ]
    lado_direito = [
        sum(desenho[i][a] * alvo[i] for i in range(len(desenho)))
        for a in range(largura)
    ]
    return resolver(normal, lado_direito)


def prever(desenho: list[list[float]], coeficientes: list[float]) -> list[float]:
    return [
        sum(linha[i] * coeficientes[i] for i in range(len(coeficientes)))
        for linha in desenho
    ]


def mape(reais: Sequence[float], previstos: Sequence[float]) -> float:
    return 100 * statistics.fmean(
        abs(previsto - real) / real for real, previsto in zip(reais, previstos)
    )


def mae(reais: Sequence[float], previstos: Sequence[float]) -> float:
    return statistics.fmean(
        abs(previsto - real) for real, previsto in zip(reais, previstos)
    )


def mape_do_nulo(reais: Sequence[float]) -> float:
    """MAPE do preditor trivial: a média dos OUTROS animais, um a um.

    É a comparação obrigatória. Um modelo que não bate isto não aprendeu a
    relação forma-peso — está a devolver a média com passos pelo meio.
    """
    previstos = [
        statistics.fmean(reais[:i] + reais[i + 1 :]) for i in range(len(reais))
    ]
    return mape(reais, previstos)


def verificar(
    obtido: float,
    esperado: float,
    tolerancia: float,
    rotulo: str,
) -> int:
    """Compara com o valor de referência. Devolve 0 se bate, 1 se regrediu."""
    desvio = abs(obtido - esperado)
    if desvio > tolerancia:
        print(
            f"❌ {rotulo}: {obtido:.2f}% difere do esperado {esperado:.2f}% "
            f"em {desvio:.2f} pp (tolerância {tolerancia:.2f} pp)"
        )
        return 1
    print(f"✅ {rotulo}: {obtido:.2f}% (esperado {esperado:.2f}%)")
    return 0
