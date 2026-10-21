import json
import csv
import numpy as np
import math

# 103 Hereford, medidas MANUAIS + peso (o dados.pkl original foi substituído por este CSV,
# com as mesmas colunas e a mesma ordem de linhas -- reproduz os números de 21/08)
H = [
    dict(
        w=float(r["peso_kg"]),
        girth=float(r["perimetro_toracico_cm"]),
        hip_h=float(r["altura_garupa_cm"]),
        withers=float(r["altura_cernelha_cm"]),
        chest_w=float(r["largura_peito_cm"]),
    )
    for r in csv.DictReader(open("cowdatabase1_hereford_103.csv"))
]
C = json.load(open("caracteristicas.json"))  # medidas AUTOMÁTICAS da nuvem
pares = []  # ficheiro N_AutoAligned.ply corresponde à linha N+1 (ficheiros indexados a zero)
# VERIFICADO: o ficheiro N_AutoAligned.ply corresponde à linha N+1 do Excel
# (ficheiros indexados a zero). O desfasamento foi confirmado por varrimento:
# r(cernelha) sobe de 0,288 para 0,601 e r(volume x peso) de 0,154 para 0,446.
for i, d in enumerate(H, start=1):
    a = C.get(str(i - 1))
    if a:
        pares.append((d, a))
print(f"animais com peso + medidas manuais + nuvem medida: {len(pares)}")
y = np.array([d["w"] for d, _ in pares])
AUTO = [
    "comprimento",
    "largura",
    "altura_cernelha",
    "altura_garupa",
    "largura_garupa",
    "perimetro_toracico",
    "perimetro_max",
    "volume",
    "area_planta",
    "altura_dorso",
]
MAN = ["girth", "hip_h", "withers", "chest_w"]


def col(ks, fonte):
    if fonte == "auto":
        return np.column_stack([[a[k] for _, a in pares] for k in ks])
    return np.column_stack([[d[k] for d, _ in pares] for k in ks])


def loocv(X):
    X = np.column_stack([np.ones(len(X)), X])
    p = np.empty(len(y))
    for i in range(len(y)):
        m = np.ones(len(y), bool)
        m[i] = False
        p[i] = X[i] @ np.linalg.lstsq(X[m], y[m], rcond=None)[0]
    return p


def mape(t, p):
    return 100 * np.mean(np.abs(p - t) / t)


def mae(t, p):
    return np.mean(np.abs(p - t))


def ic(r, n):
    z = math.atanh(max(min(r, 0.9999), -0.9999))
    s = 1 / math.sqrt(n - 3)
    return math.tanh(z - 1.96 * s), math.tanh(z + 1.96 * s)


nulo = np.array([np.mean(np.delete(y, i)) for i in range(len(y))])

print(f"\n{'preditor':46s} {'MAPE':>7s} {'MAE':>8s} {'r':>7s}  IC95%")


def linha(nome, p):
    r = np.corrcoef(p, y)[0, 1]
    lo, hi = ic(r, len(y))
    print(
        f"{nome:46s} {mape(y, p):6.2f}% {mae(y, p):6.1f}kg {r:7.3f}  [{lo:.3f}, {hi:.3f}]"
    )


linha("NULO (média da coorte)", nulo)
linha("MANUAL 4 medidas (o tecto conhecido)", loocv(col(MAN, "man")))
print()
linha("AUTO só volume", loocv(col(["volume"], "auto")))
linha("AUTO volume + comprimento", loocv(col(["volume", "comprimento"], "auto")))
linha(
    "AUTO 4 análogas às manuais",
    loocv(
        col(
            ["perimetro_toracico", "altura_garupa", "altura_cernelha", "largura"],
            "auto",
        )
    ),
)
linha("AUTO todas as 10", loocv(col(AUTO, "auto")))
print()
print("=== concordância medida automática vs manual ===")
for auto, man, lbl in (
    ("altura_cernelha", "withers", "cernelha"),
    ("altura_garupa", "hip_h", "garupa"),
):
    a = np.array([x[auto] for _, x in pares]) * 100
    m = np.array([d[man] for d, _ in pares])
    print(
        f"  {lbl:9s} auto {a.mean():6.1f} cm · manual {m.mean():6.1f} cm · viés {a.mean() - m.mean():+5.1f} cm ({100 * (a.mean() - m.mean()) / m.mean():+5.1f}%) · r={np.corrcoef(a, m)[0, 1]:.3f}"
    )
