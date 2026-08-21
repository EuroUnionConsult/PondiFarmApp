"""Normaliza as coortes públicas para o CSV interno definido em
backend/ml/datasets/README.md.  Executar a partir da raiz do repositório."""
import csv, pickle, zipfile, re, sys
from pathlib import Path
from xml.etree import ElementTree as ET

NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
COLS = ["dataset_source","external_animal_id","breed","sex","age_months",
        "body_length_cm","withers_height_cm","thoracic_depth_cm",
        "rump_width_cm","chest_girth_cm","real_weight_kg","notes"]

def folha(caminho):
    z = zipfile.ZipFile(caminho); ss = []
    if 'xl/sharedStrings.xml' in z.namelist():
        for si in ET.fromstring(z.read('xl/sharedStrings.xml')):
            ss.append(''.join(t.text or '' for t in si.iter(NS + 't')))
    def idx(c):
        n = 0
        for ch in re.match(r'[A-Z]+', c).group(): n = n * 26 + ord(ch) - 64
        return n - 1
    nome = [x for x in z.namelist() if re.match(r'xl/worksheets/sheet\d+\.xml$', x)][0]
    for r in ET.fromstring(z.read(nome)).iter(NS + 'row'):
        d = {}
        for c in r.findall(NS + 'c'):
            v = c.find(NS + 'v')
            if v is None: continue
            d[idx(c.get('r'))] = ss[int(v.text)] if c.get('t') == 's' else v.text
        yield [d.get(i, '') for i in range(max(d) + 1)] if d else []

def num(x):
    try: return float(str(x).replace(',', '.'))
    except Exception: return None

def hereford(p):
    """CowDatabase — 103 Hereford, 9 medidas de fita. Ruchay et al. 2020,
    Comput. Electron. Agric. 179:105821. rump_width = largura do ílio."""
    linhas = []
    for i, r in enumerate(folha(p)):
        if i == 0 or len(r) < 11: continue
        w, wh, hh, cd, cw, iw, hjw, obl, hl, hg = [num(r[j]) for j in range(1, 11)]
        if None in (w, wh, cd, iw, hg): continue
        linhas.append(dict(dataset_source="CowDatabase", external_animal_id=str(int(num(r[0]))),
            breed="Hereford", sex="female", age_months="",
            body_length_cm=obl, withers_height_cm=wh, thoracic_depth_cm=cd,
            rump_width_cm=iw, chest_girth_cm=hg, real_weight_kg=w,
            notes="tape morphometrics; rump_width = ilium width"))
    return linhas

def angus(p, fonte, raca, sexo, col_peso, nota):
    """CowDatabase2 e 3 — só 4 medidas: cernelha, garupa, largura do peito e
    perímetro. Sem comprimento nem profundidade torácica."""
    linhas = []
    for r in folha(p):
        if len(r) < max(15, col_peso + 1): continue
        n = num(r[0])
        if n is None or not (1 <= n <= 200): continue
        wh, hh, cw, hg = [num(r[j]) for j in (11, 12, 13, 14)] if fonte == "CowDatabase2" \
                         else [num(r[j]) for j in (8, 9, 10, 11)]
        w = num(r[col_peso])
        if None in (wh, hg, w): continue
        linhas.append(dict(dataset_source=fonte, external_animal_id=str(int(n)),
            breed=raca, sex=sexo, age_months="",
            body_length_cm="", withers_height_cm=wh, thoracic_depth_cm="",
            rump_width_cm="", chest_girth_cm=hg, real_weight_kg=w, notes=nota))
    return linhas

def acl(p):
    linhas = []
    for r in csv.DictReader(open(p)):
        linhas.append(dict(dataset_source="ACL-TP-03/2022", external_animal_id=r['external_animal_id'],
            breed="Limousine", sex="male", age_months=r['age_months'],
            body_length_cm="", withers_height_cm=r['withers_height_cm'], thoracic_depth_cm="",
            rump_width_cm=r['rump_width_cm'], chest_girth_cm=r['chest_girth_cm'],
            real_weight_kg=r['real_weight_kg'],
            notes="station performance test; measured at exit (confirmed with ACL)"))
    return linhas

if __name__ == "__main__":
    D = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.home()/"Downloads"
    V = Path.home()/"Documents/instruções claude/Livestock Project/02_Ciencia_e_Dados"
    saida = Path("backend/ml/datasets/processed"); saida.mkdir(parents=True, exist_ok=True)
    conjuntos = [
        ("cowdatabase_hereford_103.csv", hereford(D/"Measurements.xlsx")),
        ("cowdatabase2_angus_96.csv",  angus(D/"Database2022v2 (1).xlsx","CowDatabase2","Aberdeen Angus","female",10,"Voronezh cohort; 4 measurements only")),
        ("cowdatabase3_angus_93.csv",  angus(D/"CowDatabase3_Database2023v2.xlsx","CowDatabase3","Aberdeen Angus","female",13,"heifers, fattening; weight of 11/10/2022; NOT for training, weight CV 3.43%")),
        ("acl_limousine_15.csv",       acl(V/"limousine_apcrl_teste_performance_2022.csv")),
    ]
    for nome, linhas in conjuntos:
        with open(saida/nome, "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=COLS); w.writeheader(); w.writerows(linhas)
        print(f"  {nome:34s} {len(linhas):4d} animais")
