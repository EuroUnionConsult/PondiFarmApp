"""Rebuild data/pt_postcodes.tsv.gz from the GeoNames postal code dump for Portugal.

Source: https://download.geonames.org/export/zip/PT.zip
Licence: Creative Commons Attribution 4.0 (https://creativecommons.org/licenses/by/4.0/),
as stated in https://download.geonames.org/export/zip/readme.txt. Credit GeoNames
(https://www.geonames.org) wherever the data is shown.

Usage (from backend/):
    curl -o /tmp/PT.zip https://download.geonames.org/export/zip/PT.zip
    unzip -o /tmp/PT.zip PT.txt -d /tmp
    python scripts/build_pt_postcodes.py /tmp/PT.txt

Output format (UTF-8, gzip):
    # comment lines
    L<TAB>place<TAB>parish<TAB>municipality<TAB>district<TAB>lat<TAB>lon   (one per locality)
    <7-digit code as int><TAB><locality index>                         (sorted by code)
Coordinates are rounded to 2 decimals (~1 km), the same precision the API stores.
"""

from __future__ import annotations

import csv
import gzip
import sys
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "data" / "pt_postcodes.tsv.gz"


def main(src: str) -> None:
    locs: dict[tuple, int] = {}
    codes: dict[int, int] = {}
    with open(src, encoding="utf-8") as f:
        for r in csv.reader(f, delimiter="\t"):
            if len(r) < 11 or r[0] != "PT":
                continue
            code = int(r[1].replace("-", ""))
            if code in codes:
                continue  # first locality listed for a code wins
            loc = (
                r[2].strip(),
                (r[7] or "").strip(),
                r[5].strip(),
                r[3].strip(),
                f"{float(r[9]):.2f}",
                f"{float(r[10]):.2f}",
            )
            codes[code] = locs.setdefault(loc, len(locs))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with gzip.GzipFile(OUT, "wb", compresslevel=9, mtime=0) as out:
        out.write(
            b"# Portuguese postal codes. Source: GeoNames (https://www.geonames.org),\n"
            b"# licensed CC BY 4.0. Rebuild with scripts/build_pt_postcodes.py.\n"
        )
        for loc in sorted(locs, key=locs.get):
            out.write(("L\t" + "\t".join(loc) + "\n").encode())
        for code in sorted(codes):
            out.write(f"{code}\t{codes[code]}\n".encode())
    print(f"{len(codes)} codes, {len(locs)} localities -> {OUT}")


if __name__ == "__main__":
    main(sys.argv[1])
