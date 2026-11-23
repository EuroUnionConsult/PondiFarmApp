"""Offline Portuguese postal codes and small-place names (GeoNames, CC BY 4.0).

The table lives in data/pt_postcodes.tsv.gz (see data/README.md for source and
licence). It is loaded lazily on first use and kept in compact arrays: ~200 000
codes take about 2 MB of memory instead of a dict of tuples.
"""

from __future__ import annotations

import gzip
import logging
import re
import threading
import unicodedata
from array import array
from bisect import bisect_left
from pathlib import Path

log = logging.getLogger("pondifarm.postcodes")

DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "pt_postcodes.tsv.gz"
ATTRIBUTION = "GeoNames (geonames.org), CC BY 4.0"

# 4935-585 · 4935 585 · 4935585 · 4935 (with optional "PT"/"CP" prefix noise trimmed).
POSTCODE_RE = re.compile(r"^\s*(\d{4})(?:\s*[-‐–—]?\s*(\d{3}))?\s*$")

_lock = threading.Lock()
_loaded = False
_codes = array("I")  # sorted 7-digit codes as ints
_loc_of = array("I")  # locality index for each code
_locs: list[tuple[str, str, str, str, float, float]] = []
_name_index: dict[str, list[int]] = {}


def parse_postcode(q: str) -> tuple[str, str | None] | None:
    """('4935', '585') · ('4935', None) for a bare 4-digit code · None if not a code."""
    m = POSTCODE_RE.match(q or "")
    if not m:
        return None
    return m.group(1), m.group(2)


def _fold(s: str) -> str:
    """Lowercase without accents: 'Chafé' ~ 'chafe'."""
    s = unicodedata.normalize("NFKD", s or "")
    return " ".join(
        "".join(c for c in s if not unicodedata.combining(c)).lower().split()
    )


def _load() -> None:
    global _loaded
    if _loaded:
        return
    with _lock:
        if _loaded:
            return
        if not DATA_FILE.exists():
            log.error("postcode table missing", extra={"path": str(DATA_FILE)})
            _loaded = True
            return
        with gzip.open(DATA_FILE, "rt", encoding="utf-8") as f:
            for line in f:
                if line.startswith("#"):
                    continue
                parts = line.rstrip("\n").split("\t")
                if parts[0] == "L":
                    place, parish, muni, district, lat, lon = parts[1:7]
                    _locs.append(
                        (place, parish, muni, district, float(lat), float(lon))
                    )
                else:
                    _codes.append(int(parts[0]))
                    _loc_of.append(int(parts[1]))
        for i, (place, parish, _m, _d, _la, _lo) in enumerate(_locs):
            for n in {_fold(place), _fold(parish)}:
                if n:
                    _name_index.setdefault(n, []).append(i)
        _loaded = True
        log.info(
            "postcode table loaded",
            extra={"codes": len(_codes), "localities": len(_locs)},
        )


def _label(i: int) -> str:
    place, _parish, muni, _district, _lat, _lon = _locs[i]
    return " · ".join(p for p in dict.fromkeys((place, muni)) if p)


def _result(i: int) -> dict:
    place, _parish, _muni, _district, lat, lon = _locs[i]
    return {"label": _label(i), "lat": lat, "lon": lon}


def lookup(code4: str, code3: str | None, limit: int = 5) -> list[dict]:
    """Exact 7-digit code first; with only 4 digits (or an unknown 7-digit code), the
    localities of that 4-digit area, most common first."""
    _load()
    if not _codes:
        return []
    base = int(code4) * 1000
    if code3 is not None:
        full = base + int(code3)
        k = bisect_left(_codes, full)
        if k < len(_codes) and _codes[k] == full:
            return [_result(_loc_of[k])]
    lo, hi = bisect_left(_codes, base), bisect_left(_codes, base + 1000)
    if lo == hi:
        return []
    counts: dict[int, int] = {}
    for k in range(lo, hi):
        counts[_loc_of[k]] = counts.get(_loc_of[k], 0) + 1
    # Group by label: one "Viana do Castelo" even if it has many coordinate variants.
    agg: dict[str, list[int]] = {}  # label -> [total codes, best locality, its count]
    for i, n in counts.items():
        a = agg.setdefault(_label(i), [0, i, 0])
        a[0] += n
        if n > a[2]:
            a[1], a[2] = i, n
    ranked = sorted(agg.values(), key=lambda a: -a[0])
    return [_result(a[1]) for a in ranked[:limit]]


def search_name(q: str, limit: int = 6) -> list[dict]:
    """Places (localities or parishes) whose name matches `q` exactly, ignoring case and
    accents; then names that start with it. Covers small parishes Open-Meteo lacks."""
    _load()
    key = _fold(q)
    if len(key) < 3:
        return []
    hits = list(_name_index.get(key, []))
    if len(hits) < limit:
        hits += [
            i
            for n, ids in _name_index.items()
            if n != key and n.startswith(key)
            for i in ids
        ]
    out, seen = [], set()
    for i in hits:
        r = _result(i)
        sig = (r["label"], round(r["lat"], 1), round(r["lon"], 1))
        if sig in seen:
            continue
        seen.add(sig)
        out.append(r)
        if len(out) >= limit:
            break
    return out
