# Bundled data

## `pt_postcodes.tsv.gz` — Portuguese postal codes

- **What:** every Portuguese 7-digit postal code (≈198 000) mapped to its locality,
  parish, municipality, district and approximate coordinates (rounded to 2 decimals, ~1 km).
- **Used by:** `services/pt_postcodes.py` — the farm-location search resolves postcodes
  (`4935-585`, `4935 585`, `4935585`, `4935`) offline first, and falls back to
  OpenStreetMap Nominatim only when a code is not in the table. It also answers name
  searches for small places (parishes/villages) that the Open-Meteo geocoder does not know.
- **Source:** GeoNames postal code dump, <https://download.geonames.org/export/zip/PT.zip>,
  downloaded 2026-11-23.
- **Licence:** Creative Commons Attribution 4.0 International
  (<https://creativecommons.org/licenses/by/4.0/>), as stated in
  <https://download.geonames.org/export/zip/readme.txt>. Commercial use and redistribution
  are allowed with attribution. Credit: **GeoNames, <https://www.geonames.org>** — the
  location picker in the apps shows this credit.
- **Rebuild:** `python scripts/build_pt_postcodes.py /path/to/PT.txt` (see the script header).
- **Caveat:** GeoNames coordinates are estimates (often the locality centroid); they are good
  enough for a weather forecast, not for addressing.
