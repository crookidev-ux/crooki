#!/usr/bin/env python3
"""Genera src/lib/delivery-zones.data.ts desde la hoja "Tarifas por barrio".

Uso: python -X utf8 scripts/import_delivery_zones.py "<ruta al xlsx>"
"""
import json
import re
import sys
import unicodedata
from collections import Counter
from pathlib import Path

import openpyxl

SHEET = "Tarifas por barrio"
OUT = Path(__file__).resolve().parent.parent / "src" / "lib" / "delivery-zones.data.ts"


def slug(text: str) -> str:
    s = unicodedata.normalize("NFD", text)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn").lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def sort_key(text: str) -> str:
    return slug(text)


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit('Uso: python -X utf8 scripts/import_delivery_zones.py "<ruta al xlsx>"')
    wb = openpyxl.load_workbook(sys.argv[1], data_only=True, read_only=True)
    ws = wb[SHEET]
    raw = []
    for row in list(ws.iter_rows(values_only=True))[1:]:
        _loc, ucg, barrio, _dist, _how, tarifa, _origin = (list(row) + [None] * 7)[:7]
        if barrio is None or not str(barrio).strip():
            continue
        name = str(barrio).strip()
        ucg_s = str(ucg).strip() if ucg is not None else ""
        if ucg_s.isdigit():
            sector, suffix = f"UCG {ucg_s}", f"ucg{ucg_s}"
        else:
            sector, suffix = ucg_s, slug(ucg_s)
        if isinstance(tarifa, str):
            tarifa = int(tarifa) if tarifa.strip().isdigit() else None
        fee = int(tarifa) if tarifa is not None else None
        raw.append({"name": name, "sector": sector, "suffix": suffix, "fee": fee})

    counts = Counter(r["name"] for r in raw)
    zones, used = [], set()
    for r in raw:
        dup = counts[r["name"]] > 1
        zid = slug(r["name"]) + (f"-{r['suffix']}" if dup else "")
        n = 2
        base = zid
        while zid in used:  # mismo nombre y mismo sector
            zid = f"{base}-{n}"
            n += 1
        used.add(zid)
        name = f"{r['name']} ({r['sector']})" if dup else r["name"]
        zones.append({"id": zid, "name": name, "sector": r["sector"], "fee": r["fee"]})
    zones.sort(key=lambda z: (sort_key(z["name"]), z["id"]))

    lines = [
        "// GENERADO por scripts/import_delivery_zones.py desde la hoja \"Tarifas por barrio\".",
        "// No editar a mano: vuelve a correr el script cuando cambien las tarifas.",
        "",
        'import type { DeliveryZone } from "./delivery-zones.ts";',
        "",
        "export const DELIVERY_ZONES: DeliveryZone[] = [",
    ]
    for z in zones:
        lines.append(f"  {json.dumps(z, ensure_ascii=False)},")
    lines.append("];")
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    withfee = sum(1 for z in zones if z["fee"] is not None)
    print(f"zonas={len(zones)} con_tarifa={withfee} consultar={len(zones) - withfee}")


if __name__ == "__main__":
    main()
