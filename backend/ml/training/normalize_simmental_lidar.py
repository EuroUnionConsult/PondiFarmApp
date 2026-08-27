"""Normaliza a folha Simmental (UAV-LiDAR) do PondiFarm_OpenBeef_Datasets.xlsx
para o CSV interno.

A coorte é de Wang et al. 2024 (Zenodo 11277007, CC-BY 4.0): touros jovens
Simmental sobrevoados por UAV com LiDAR, com peso de balança emparelhado. As
medidas vêm em METROS no ficheiro de origem e são convertidas para centímetros.

Duas notas que decidem como o dado pode ser usado, e que por isso ficam no
próprio ficheiro em vez de num documento à parte:

1. São 95 registos mas apenas 45 animais — o mesmo animal é sobrevoado em até
   três campanhas. Qualquer validação tem de ser por identidade animal. Uma
   divisão por linha põe o mesmo animal no treino e no teste e devolve um
   número que não significa nada.

2. NÃO há perímetro torácico. O LiDAR aéreo vê o animal de cima e não fecha uma
   circunferência. A coluna fica vazia de propósito: vazio quer dizer que a
   modalidade não mede, não que o valor se perdeu.

Sem openpyxl de propósito. O sibling normalize_limousin_series.py usa-o, mas o
openpyxl não está no requirements.txt, e um CSV derivado que só se regenera em
algumas máquinas deixa de ser reprodutível. Um XLSX é um zip de XML e a
biblioteca-padrão chega para o ler.

Correr a partir da raiz do repositório:
    python backend/ml/training/normalize_simmental_lidar.py <caminho-do-xlsx>
"""

from __future__ import annotations

import csv
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree

RAIZ = Path(__file__).resolve().parents[3]
SAIDA = (
    RAIZ / "backend" / "ml" / "datasets" / "processed" / "simmental_uav_lidar_95.csv"
)
FOLHA = "Simmental (UAV-LiDAR)"

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
NSR = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"

COLUNAS = [
    "dataset_source",
    "external_animal_id",
    "campaign",
    "breed",
    "sex",
    "abdominal_width_cm",
    "abdominal_width_2_cm",
    "hip_height_cm",
    "withers_height_cm",
    "wih_cm",
    "bh_cm",
    "body_length_cm",
    "chest_girth_cm",
    "thoracic_depth_cm",
    "real_weight_kg",
    "notes",
]

# Nomes do artigo -> coluna interna. WiH e BH ficam com o nome original: a
# legenda da fonte diz apenas "alturas" e não define a referência anatómica.
# Inventar-lhes um nome seria fingir uma precisão que a fonte não dá.
DESCRITORES = {
    "AW": "abdominal_width_cm",
    "AW2": "abdominal_width_2_cm",
    "HH": "hip_height_cm",
    "WH": "withers_height_cm",
    "WiH": "wih_cm",
    "BH": "bh_cm",
    "MBL": "body_length_cm",
}


def indice_coluna(referencia: str) -> int:
    letras = re.match(r"([A-Z]+)", referencia).group(1)
    numero = 0
    for letra in letras:
        numero = numero * 26 + ord(letra) - 64
    return numero - 1


def ler_folha(caminho: Path, nome_folha: str) -> list[list[str]]:
    arquivo = zipfile.ZipFile(caminho)

    livro = ElementTree.fromstring(arquivo.read("xl/workbook.xml"))
    relacoes = {
        relacao.get("Id"): relacao.get("Target")
        for relacao in ElementTree.fromstring(
            arquivo.read("xl/_rels/workbook.xml.rels")
        )
    }
    alvo = None
    for folha in livro.find(NS + "sheets"):
        if folha.get("name") == nome_folha:
            alvo = relacoes[folha.get(NSR + "id")].lstrip("/").replace("xl/", "")
    if alvo is None:
        sys.exit(f"O ficheiro não tem a folha {nome_folha!r}.")

    partilhadas: list[str] = []
    if "xl/sharedStrings.xml" in arquivo.namelist():
        partilhadas = [
            "".join(pedaco.text or "" for pedaco in item.iter(NS + "t"))
            for item in ElementTree.fromstring(arquivo.read("xl/sharedStrings.xml"))
        ]

    linhas = []
    for linha in ElementTree.fromstring(arquivo.read("xl/" + alvo)).iter(NS + "row"):
        celulas: dict[int, str] = {}
        for celula in linha.iter(NS + "c"):
            valor = celula.find(NS + "v")
            tipo = celula.get("t")
            if tipo == "inlineStr":
                texto = "".join(t.text or "" for t in celula.iter(NS + "t"))
            elif valor is None:
                texto = ""
            elif tipo == "s":
                texto = partilhadas[int(valor.text)]
            else:
                texto = valor.text
            celulas[indice_coluna(celula.get("r"))] = texto
        if celulas:
            linhas.append([celulas.get(i, "") for i in range(max(celulas) + 1)])
    return linhas


def centimetros(valor: str) -> str:
    """Metros -> centímetros. Devolve vazio se a origem não tiver o valor."""
    try:
        return f"{float(valor) * 100:.2f}"
    except (TypeError, ValueError):
        return ""


def main() -> int:
    origem = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    if origem is None or not origem.exists():
        sys.exit(
            "Indique o caminho para PondiFarm_OpenBeef_Datasets.xlsx.\n"
            "A fonte não é versionada; o CSV derivado é."
        )

    linhas = ler_folha(origem, FOLHA)
    cabecalho = next(linha for linha in linhas if "Weight" in linha)
    posicao = {nome: i for i, nome in enumerate(cabecalho)}
    dados = [
        linha
        for linha in linhas[linhas.index(cabecalho) + 1 :]
        if linha and linha[0].isdigit()
    ]

    registos = []
    for linha in dados:
        registo = {
            "dataset_source": "Wang2024/Zenodo-11277007",
            "external_animal_id": linha[posicao["ids"]],
            "campaign": linha[posicao["campaign"]],
            "breed": "Simmental",
            "sex": "male",
            # Vazias porque o UAV-LiDAR não as mede, não porque se perderam.
            "chest_girth_cm": "",
            "thoracic_depth_cm": "",
            "real_weight_kg": linha[posicao["Weight"]],
            "notes": "young bulls, UAV-LiDAR; no chest girth in this modality",
        }
        for nome_fonte, nome_interno in DESCRITORES.items():
            registo[nome_interno] = centimetros(linha[posicao[nome_fonte]])
        registos.append(registo)

    SAIDA.parent.mkdir(parents=True, exist_ok=True)
    with SAIDA.open("w", newline="") as ficheiro:
        escritor = csv.DictWriter(ficheiro, fieldnames=COLUNAS)
        escritor.writeheader()
        escritor.writerows(registos)

    animais = {registo["external_animal_id"] for registo in registos}
    print(f"{SAIDA.name}: {len(registos)} registos, {len(animais)} animais únicos")
    print(f"  campanhas: {len({r['campaign'] for r in registos})}")
    print("  perímetro torácico: ausente por construção (LiDAR aéreo)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
