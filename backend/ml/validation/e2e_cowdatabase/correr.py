import glob
import re
import json
from extrator import ler_ply, caracteristicas

saida = {}
fich = sorted(
    glob.glob("nuvens/*_AutoAligned.ply"),
    key=lambda p: int(re.search(r"(\d+)_", p).group(1)),
)
for k, p in enumerate(fich, 1):
    i = int(re.search(r"(\d+)_", p).group(1))
    try:
        r = caracteristicas(ler_ply(p))
        saida[i] = r
        print(
            f"{k:3d}/{len(fich)}  animal {i:3d}  {'ok' if r else 'FALHOU'}", flush=True
        )
    except Exception as ex:
        print(f"{k:3d}/{len(fich)}  animal {i:3d}  ERRO {ex}", flush=True)
json.dump(saida, open("caracteristicas.json", "w"))
print("gravado:", len([v for v in saida.values() if v]), "animais medidos")
