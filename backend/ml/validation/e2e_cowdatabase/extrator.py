"""Extrai características automáticas de uma nuvem alinhada do CowDatabase.
Sem intervenção humana por animal: caixa de trabalho fixa (equipamento fixo),
deteção do chão por moda, maior aglomerado em planta.  Espelha o MeshCropper +
MeshMeasurer da app."""

import numpy as np
from collections import Counter, deque
from scipy.spatial import ConvexHull


def ler_ply(p):
    nh = 0
    with open(p, "r", errors="ignore") as f:
        for line in f:
            nh += 1
            if line.strip() == "end_header":
                break
            if line.startswith("element vertex"):
                n = int(line.split()[-1])
    return np.loadtxt(p, skiprows=nh, max_rows=n, usecols=(0, 1, 2))


def isolar(xyz):
    z = xyz[:, 2]
    # O chão é o plano horizontal mais povoado ENTRE OS MAIS BAIXOS (Z cresce p/ baixo).
    # Restringir ao quartil inferior impede que uma parede vertical densa seja
    # confundida com o solo -- falhava em 3 de 25 animais, com 79 cm de erro.
    lim = np.percentile(z, 75)
    zb = z[z > lim]
    h, e = np.histogram(zb, bins=60)
    m = (e[:-1] + e[1:]) / 2
    zc = m[np.argmax(h)]
    alt = zc - z
    box = (
        (np.abs(xyz[:, 0]) < 1.8)
        & (xyz[:, 1] > -1.3)
        & (xyz[:, 1] < 1.1)
        & (alt > 0.20)
        & (alt < 1.95)
    )
    p = xyz[box]
    a = alt[box]
    if len(p) < 2000:
        return None, None
    g = np.floor(p[:, :2] / 0.08).astype(np.int64)
    oc = set(map(tuple, g))
    cnt = Counter(map(tuple, g))
    vis = set()
    best = []
    for c in oc:
        if c in vis:
            continue
        q = deque([c])
        vis.add(c)
        gr = []
        while q:
            x = q.popleft()
            gr.append(x)
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    v = (x[0] + dx, x[1] + dy)
                    if v in oc and v not in vis:
                        vis.add(v)
                        q.append(v)
        if sum(cnt[k] for k in gr) > sum(cnt[k] for k in best):
            best = gr
    sel = set(best)
    keep = np.array([tuple(c) in sel for c in g])
    return p[keep], a[keep]


def caracteristicas(xyz):
    corpo, alt = isolar(xyz)
    if corpo is None or len(corpo) < 2000:
        return None
    xy = corpo[:, :2] - corpo[:, :2].mean(0)
    _, _, V = np.linalg.svd(xy, full_matrices=False)
    u = xy @ V[0]
    v = xy @ V[1]
    if np.mean(alt[u > np.percentile(u, 80)]) < np.mean(alt[u < np.percentile(u, 20)]):
        u = -u  # orienta: cauda alta -> frente é u baixo
    L = np.percentile(u, 99) - np.percentile(u, 1)
    W = np.percentile(v, 99) - np.percentile(v, 1)
    Hmax = np.percentile(alt, 99.5)
    # perfil do dorso ao longo do corpo, em 20 fatias
    bordas = np.linspace(np.percentile(u, 1), np.percentile(u, 99), 21)
    dorso = []
    larg = []
    per = []
    for i in range(20):
        s = (u >= bordas[i]) & (u < bordas[i + 1])
        if s.sum() < 40:
            dorso.append(np.nan)
            larg.append(np.nan)
            per.append(np.nan)
            continue
        dorso.append(np.percentile(alt[s], 98))
        larg.append(np.percentile(v[s], 98) - np.percentile(v[s], 2))
        pts = np.column_stack([v[s], alt[s]])
        try:
            hl = ConvexHull(pts)
            o = pts[hl.vertices]
            per.append(
                np.sum(np.linalg.norm(np.diff(np.vstack([o, o[:1]]), axis=0), axis=1))
            )
        except Exception:
            per.append(np.nan)
    dorso = np.array(dorso)
    larg = np.array(larg)
    per = np.array(per)
    # volume por colunas de 4 cm em planta
    gr = np.floor(np.column_stack([u, v]) / 0.04).astype(np.int64)
    d = {}
    for k, h_ in zip(map(tuple, gr), alt):
        if k not in d or h_ > d[k]:
            d[k] = h_
    vol = sum(d.values()) * 0.04 * 0.04
    area = len(d) * 0.04 * 0.04
    return dict(
        comprimento=L,
        largura=W,
        altura_max=Hmax,
        altura_dorso=np.nanmedian(dorso[5:16]),
        altura_cernelha=np.nanmax(dorso[3:9]),  # terço dianteiro
        altura_garupa=np.nanmax(dorso[12:18]),  # terço traseiro
        largura_max=np.nanmax(larg),
        largura_garupa=np.nanmedian(larg[13:17]),
        perimetro_max=np.nanmax(per),
        perimetro_toracico=np.nanmedian(per[6:10]),
        volume=vol,
        area_planta=area,
        n_pontos=len(corpo),
    )
