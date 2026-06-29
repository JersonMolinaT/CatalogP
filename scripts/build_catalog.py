#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PERFUMES ORIGINALES - Constructor de catalogo e ingesta de fotos.

Que hace:
  1. Lee las fotos crudas (carpeta SOURCE_DIR).
  2. Calcula el hash SHA-256 de cada foto -> ID unico por contenido (evita
     subir/duplicar la misma imagen aunque cambie el nombre).
  3. Renombra/copia cada foto con un ID legible:  {SKU}-{seq}-{hash8}.jpg
  4. Mantiene un registro (registry.csv) para que en ejecuciones diarias solo
     procese fotos NUEVAS (hash no visto antes).
  5. Genera el catalogo de datos: products.json + photos_manifest.csv

Reutilizable a diario:  vuelve a ejecutar el script tras agregar fotos nuevas a
la carpeta de origen. Las ya procesadas se omiten por hash.
"""

import csv
import hashlib
import json
import os
import shutil
from datetime import date

# ----------------------------------------------------------------------------
# RUTAS (ajusta SOURCE_DIR si mueves la carpeta de fotos crudas)
# ----------------------------------------------------------------------------
SOURCE_DIR = os.environ.get("SOURCE_DIR", "/sessions/festive-focused-wright/mnt/Perfumes")
PROJECT_DIR = os.environ.get("PROJECT_DIR", "/sessions/festive-focused-wright/mnt/CatalogP")

ASSETS_DIR = os.path.join(PROJECT_DIR, "assets", "products")
DATA_DIR = os.path.join(PROJECT_DIR, "data")
REGISTRY = os.path.join(DATA_DIR, "registry.csv")

# Sitio web estatico (self-contained para abrir con doble clic)
WEB_DIR = os.path.join(PROJECT_DIR, "web")
WEB_IMG_DIR = os.path.join(WEB_DIR, "assets", "products")
WEB_JS_DIR = os.path.join(WEB_DIR, "js")

os.makedirs(ASSETS_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(WEB_IMG_DIR, exist_ok=True)
os.makedirs(WEB_JS_DIR, exist_ok=True)

# ----------------------------------------------------------------------------
# DATOS COMERCIALES por SKU  ->  EDITA AQUI cuando tengas precios/stock.
#   price      : precio actual (numero) o None para "Consultar"
#   price_old  : precio anterior tachado (oferta) o None
#   stock      : unidades disponibles o None
# ----------------------------------------------------------------------------
CURRENCY = "COP"   # peso colombiano (cambia si aplica)
COMMERCIAL = {
    "LAT-OFG": {"price": 250000, "price_old": None, "stock": 14},
    "LAT-AME": {"price": 250000, "price_old": None, "stock": 12},
    "LAT-YAR": {"price": 250000, "price_old": None, "stock": 8},
    "LAT-YRT": {"price": 250000, "price_old": None, "stock": 8},
    "MIL-GLE": {"price": 350000, "price_old": None, "stock": 8},
    "LAT-AJW": {"price": 250000, "price_old": None, "stock": 13},
    "LAT-FAK": {"price": 250000, "price_old": None, "stock": 4},
    "LAT-HNG": {"price": 250000, "price_old": None, "stock": 8},
}

# Etiquetas de categoria para los filtros/secciones del Home
TAGS = {
    "LAT-OFG": ["Árabes", "Nicho", "Más vendidos"],
    "LAT-AME": ["Árabes", "Nicho"],
    "LAT-YAR": ["Árabes", "Más vendidos"],
    "LAT-YRT": ["Árabes", "Nuevos"],
    "MIL-GLE": ["Premium"],
    "LAT-AJW": ["Árabes", "Más vendidos"],
    "LAT-FAK": ["Árabes"],
    "LAT-HNG": ["Árabes", "Nuevos"],
}

# ----------------------------------------------------------------------------
# PRODUCTOS (8 referencias identificadas en las fotos)
# Notas tomadas de las fichas oficiales (Fragrantica / Lattafa / Milan Parfums)
# ----------------------------------------------------------------------------
PRODUCTS = [
    {
        "sku": "LAT-OFG",
        "brand": "Lattafa",
        "name": "Bade'e Al Oud - Oud For Glory",
        "gender": "Unisex",
        "family": "Amaderada ambarina",
        "concentration": "Eau de Parfum",
        "size_ml": 100,
        "year": 2020,
        "inspiration": "Inspirado en Initio Oud for Greatness",
        "notes_top": ["Azafran", "Nuez moscada", "Lavanda"],
        "notes_heart": ["Oud (agarwood)", "Pachuli"],
        "notes_base": ["Oud (agarwood)", "Pachuli", "Almizcle"],
        "description_es": (
            "Una firma ambar-amaderada intensa y elegante. Abre con azafran, nuez "
            "moscada y lavanda que encienden un corazon profundo de oud y pachuli, "
            "sobre un fondo almizclado y resinoso. Oscuro, especiado y sofisticado: "
            "ideal para noches, clima fresco y ocasiones de impacto. Gran proyeccion "
            "y duracion de 8-12 horas."
        ),
    },
    {
        "sku": "LAT-AME",
        "brand": "Lattafa",
        "name": "Bade'e Al Oud Amethyst",
        "gender": "Unisex",
        "family": "Oriental floral (vainilla)",
        "concentration": "Eau de Parfum",
        "size_ml": 100,
        "year": 2021,
        "inspiration": "Original",
        "notes_top": ["Pimienta rosa", "Bergamota"],
        "notes_heart": ["Rosa turca", "Rosa bulgara", "Jazmin"],
        "notes_base": ["Oud (agarwood)", "Ambar", "Vainilla"],
        "description_es": (
            "Oriental amaderado calido y sensual. Arranca con una tension especiada-"
            "floral donde la pimienta rosa aporta calor rosado y la bergamota un breve "
            "destello citrico, para asentarse en un corazon de rosas turca y bulgara con "
            "jazmin. El fondo de oud, ambar y vainilla lo vuelve denso y envolvente, con "
            "una duracion notable de 8-12 horas."
        ),
    },
    {
        "sku": "LAT-YAR",
        "brand": "Lattafa",
        "name": "Yara",
        "gender": "Mujer",
        "family": "Oriental vainilla gourmand",
        "concentration": "Eau de Parfum",
        "size_ml": 100,
        "year": 2020,
        "inspiration": "Original",
        "notes_top": ["Orquidea", "Heliotropo", "Mandarina"],
        "notes_heart": ["Acorde gourmand", "Frutas tropicales"],
        "notes_base": ["Vainilla", "Almizcle", "Sandalo"],
        "description_es": (
            "Un best-seller femenino, dulce y cremoso. Abre luminoso con la frescura "
            "jugosa de la mandarina junto a la suavidad floral del heliotropo y la "
            "orquidea. El corazon despliega frutas tropicales y un acorde gourmand "
            "calido, y el fondo de vainilla sedosa, sandalo y almizcle deja una estela "
            "adictiva. Femenino, acogedor y perfecto para el dia a dia."
        ),
    },
    {
        "sku": "LAT-YRT",
        "brand": "Lattafa",
        "name": "Yara Tous",
        "gender": "Mujer",
        "family": "Frutal tropical floral",
        "concentration": "Eau de Parfum",
        "size_ml": 100,
        "year": 2023,
        "inspiration": "Original",
        "notes_top": ["Mango", "Coco", "Maracuya"],
        "notes_heart": ["Jazmin", "Azahar", "Heliotropo"],
        "notes_base": ["Vainilla", "Almizcle", "Cashmeran"],
        "description_es": (
            "La version tropical y radiante de Yara. Abre con una dulzura jugosa de "
            "mango, maracuya y coco que la vuelve cremosa y soleada. El corazon se "
            "suaviza con heliotropo, jazmin y azahar, y el fondo de cashmeran, vainilla "
            "y almizcle deja un cierre calido y suave. Alegre, femenina y muy facil de "
            "llevar en clima calido."
        ),
    },
    {
        "sku": "MIL-GLE",
        "brand": "Milan Parfums",
        "name": "Glorious Extreme",
        "gender": "Hombre",
        "family": "Oriental especiado",
        "concentration": "Eau de Parfum",
        "size_ml": 100,
        "year": None,
        "inspiration": "Original",
        "notes_top": ["Canela"],
        "notes_heart": ["Tabaco"],
        "notes_base": ["Vainilla"],
        "description_es": (
            "Una mezcla seductora y adictiva: la canela envuelve con calidez, el tabaco "
            "seduce con profundidad y la vainilla suaviza con sensualidad. Intenso y "
            "atrevido, pensado para quien convierte cada momento en seduccion. Estela "
            "potente, ideal para noche y clima fresco."
        ),
    },
    {
        "sku": "LAT-AJW",
        "brand": "Lattafa",
        "name": "Ajwad",
        "gender": "Unisex",
        "family": "Oriental amaderada frutal",
        "concentration": "Eau de Parfum",
        "size_ml": 60,
        "year": 2021,
        "inspiration": "Original",
        "notes_top": ["Bergamota", "Lichi", "Frutos rojos"],
        "notes_heart": ["Jazmin", "Rosa", "Canela"],
        "notes_base": ["Cedro", "Sandalo", "Ambar", "Almizcle", "Vainilla"],
        "description_es": (
            "Oriental-amaderado unisex elegante y reconfortante. Abre con un estallido "
            "de bergamota, lichi y frutos rojos; el corazon revela jazmin, rosa y un "
            "toque de canela, seductor y delicado. El fondo de cedro, sandalo, vainilla "
            "caramelizada, ambar y almizcle aporta un cierre polvoso, calido y "
            "sofisticado que equilibra lo femenino y lo masculino."
        ),
    },
    {
        "sku": "LAT-FAK",
        "brand": "Lattafa",
        "name": "Fakhar (Pride of Lattafa) - Silver",
        "gender": "Hombre",
        "family": "Aromatica afrutada",
        "concentration": "Eau de Parfum",
        "size_ml": 100,
        "year": 2022,
        "inspiration": "Original",
        "notes_top": ["Manzana", "Jengibre", "Bergamota"],
        "notes_heart": ["Lavanda", "Salvia", "Enebro", "Geranio"],
        "notes_base": ["Ambar", "Haba tonka", "Vetiver", "Cedro"],
        "description_es": (
            "Masculino versatil y refinado. Abre vibrante con manzana, bergamota y "
            "jengibre, que dan una primera impresion dinamica y fresca. El corazon "
            "aromatico de lavanda, salvia y geranio aporta elegancia, y el fondo calido "
            "de ambar, cedro, haba tonka y vetiver le da cuerpo y una estela segura. "
            "Perfecto para diario, oficina y reuniones."
        ),
    },
    {
        "sku": "LAT-HNG",
        "brand": "Lattafa",
        "name": "Bade'e Al Oud Honor & Glory",
        "gender": "Unisex",
        "family": "Ambarina gourmand especiada",
        "concentration": "Eau de Parfum",
        "size_ml": 100,
        "year": 2023,
        "inspiration": "Original",
        "notes_top": ["Pina", "Creme brulee"],
        "notes_heart": ["Canela", "Curcuma", "Pimienta negra", "Benjui"],
        "notes_base": ["Vainilla", "Sandalo", "Cashmeran", "Musgo"],
        "description_es": (
            "Ambarino gourmand con un contraste dulce-especiado decadente y refinado. "
            "Abre con pina y creme brulee, sobre un corazon especiado de canela, "
            "curcuma, pimienta negra y benjui. En el fondo la vainilla suaviza la "
            "composicion con el sandalo cremoso y el cashmeran aterciopelado, cerrando "
            "con musgo terroso. Una estela pulida y duradera, como un postre servido "
            "sobre madera oscura."
        ),
    },
]

PRODUCTS_BY_SKU = {p["sku"]: p for p in PRODUCTS}

# ----------------------------------------------------------------------------
# MAPEADO foto cruda -> SKU  (clasificacion manual de las 27 fotos actuales)
# Para fotos nuevas no listadas aqui, se asignan a "UNSORTED" hasta clasificar.
# ----------------------------------------------------------------------------
PHOTO_TO_SKU = {
    "WhatsApp Image 2026-06-29 at 11.06.45 AM.jpeg": "LAT-OFG",
    "WhatsApp Image 2026-06-29 at 11.06.45 AM (1).jpeg": "LAT-OFG",
    "WhatsApp Image 2026-06-29 at 11.06.46 AM.jpeg": "LAT-OFG",
    "WhatsApp Image 2026-06-29 at 11.06.46 AM (1).jpeg": "LAT-AME",
    "WhatsApp Image 2026-06-29 at 11.06.46 AM (2).jpeg": "LAT-AME",
    "WhatsApp Image 2026-06-29 at 11.06.47 AM.jpeg": "LAT-AME",
    "WhatsApp Image 2026-06-29 at 11.06.47 AM (1).jpeg": "LAT-YAR",
    "WhatsApp Image 2026-06-29 at 11.06.47 AM (2).jpeg": "LAT-YAR",
    "WhatsApp Image 2026-06-29 at 11.06.47 AM (3).jpeg": "LAT-YAR",
    "WhatsApp Image 2026-06-29 at 11.06.47 AM (4).jpeg": "LAT-YRT",
    "WhatsApp Image 2026-06-29 at 11.06.48 AM.jpeg": "LAT-YRT",
    "WhatsApp Image 2026-06-29 at 11.06.48 AM (1).jpeg": "LAT-YRT",
    "WhatsApp Image 2026-06-29 at 11.06.48 AM (2).jpeg": "MIL-GLE",
    "WhatsApp Image 2026-06-29 at 11.06.48 AM (3).jpeg": "MIL-GLE",
    "WhatsApp Image 2026-06-29 at 11.06.49 AM.jpeg": "MIL-GLE",
    "WhatsApp Image 2026-06-29 at 11.06.49 AM (1).jpeg": "LAT-AJW",
    "WhatsApp Image 2026-06-29 at 11.06.49 AM (2).jpeg": "LAT-AJW",
    "WhatsApp Image 2026-06-29 at 11.06.49 AM (3).jpeg": "LAT-AJW",
    "WhatsApp Image 2026-06-29 at 11.06.50 AM.jpeg": "LAT-AJW",
    "WhatsApp Image 2026-06-29 at 11.06.50 AM (1).jpeg": "LAT-AJW",
    "WhatsApp Image 2026-06-29 at 11.06.50 AM (2).jpeg": "LAT-AJW",
    "WhatsApp Image 2026-06-29 at 11.06.50 AM (3).jpeg": "LAT-AJW",
    "WhatsApp Image 2026-06-29 at 11.06.51 AM.jpeg": "LAT-FAK",
    "WhatsApp Image 2026-06-29 at 11.06.51 AM (1).jpeg": "LAT-FAK",
    "WhatsApp Image 2026-06-29 at 11.06.51 AM (2).jpeg": "LAT-FAK",
    "WhatsApp Image 2026-06-29 at 11.06.51 AM (3).jpeg": "LAT-HNG",
    "WhatsApp Image 2026-06-29 at 11.06.51 AM (4).jpeg": "LAT-HNG",
}

IMG_EXT = {".jpg", ".jpeg", ".png", ".webp", ".avif"}


def sha256_of(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


def load_registry():
    seen = {}  # hash -> row dict
    if os.path.exists(REGISTRY):
        with open(REGISTRY, newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                seen[row["sha256"]] = row
    return seen


def save_registry(rows):
    fields = ["sha256", "sku", "new_filename", "original_filename", "added_on"]
    with open(REGISTRY, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for r in rows.values():
            w.writerow(r)


def next_seq(sku, registry):
    n = 0
    for r in registry.values():
        if r["sku"] == sku:
            n += 1
    return n + 1


def main():
    registry = load_registry()
    today = date.today().isoformat()
    new_count = dup_count = 0

    files = sorted(os.listdir(SOURCE_DIR))
    for fname in files:
        ext = os.path.splitext(fname)[1].lower()
        if ext not in IMG_EXT:
            continue
        src = os.path.join(SOURCE_DIR, fname)
        if not os.path.isfile(src):
            continue

        digest = sha256_of(src)
        if digest in registry:
            dup_count += 1
            continue  # ya procesada (mismo contenido) -> se omite

        sku = PHOTO_TO_SKU.get(fname, "UNSORTED")
        seq = next_seq(sku, registry)
        hash8 = digest[:8]
        new_name = f"{sku}-{seq:02d}-{hash8}.jpg"
        dst = os.path.join(ASSETS_DIR, new_name)
        shutil.copy2(src, dst)

        registry[digest] = {
            "sha256": digest,
            "sku": sku,
            "new_filename": new_name,
            "original_filename": fname,
            "added_on": today,
        }
        new_count += 1

    save_registry(registry)

    # -- photos por SKU
    photos_by_sku = {}
    for r in registry.values():
        photos_by_sku.setdefault(r["sku"], []).append(r["new_filename"])
    for k in photos_by_sku:
        photos_by_sku[k].sort()

    # -- products.json (catalogo final para la web)
    catalog = []
    for i, p in enumerate(PRODUCTS, start=1):
        item = dict(p)
        item["id"] = i
        item["slug"] = p["name"].lower().replace("'", "").replace("(", "").replace(")", "")
        item["slug"] = "-".join(item["slug"].split())
        item["photos"] = photos_by_sku.get(p["sku"], [])
        item["photo_count"] = len(item["photos"])
        # datos comerciales
        com = COMMERCIAL.get(p["sku"], {})
        item["price"] = com.get("price")
        item["price_old"] = com.get("price_old")
        item["currency"] = CURRENCY
        item["stock"] = com.get("stock")
        item["in_stock"] = (com.get("stock") is None) or (com.get("stock", 0) > 0)
        item["tags"] = TAGS.get(p["sku"], [])
        catalog.append(item)

    payload = {"generated_on": today, "currency": CURRENCY,
               "total_products": len(catalog), "products": catalog}

    with open(os.path.join(DATA_DIR, "products.json"), "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    # -- products-data.js (para que el sitio cargue sin servidor, via file://)
    with open(os.path.join(WEB_JS_DIR, "products-data.js"), "w", encoding="utf-8") as f:
        f.write("// Generado por build_catalog.py — no editar a mano.\n")
        f.write("window.CATALOG = ")
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write(";\n")

    # -- copia de imagenes al web root (sitio self-contained)
    for r in registry.values():
        src_img = os.path.join(ASSETS_DIR, r["new_filename"])
        dst_img = os.path.join(WEB_IMG_DIR, r["new_filename"])
        if os.path.exists(src_img) and not os.path.exists(dst_img):
            shutil.copy2(src_img, dst_img)

    # -- manifest CSV (lista plana foto<->producto)
    with open(os.path.join(DATA_DIR, "photos_manifest.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["new_filename", "sku", "brand", "product", "original_filename", "sha256_full"])
        for r in sorted(registry.values(), key=lambda x: x["new_filename"]):
            p = PRODUCTS_BY_SKU.get(r["sku"], {})
            w.writerow([
                r["new_filename"], r["sku"], p.get("brand", ""), p.get("name", ""),
                r["original_filename"], r["sha256"],
            ])

    # -- resumen
    print(f"Fotos nuevas procesadas : {new_count}")
    print(f"Duplicadas omitidas     : {dup_count}")
    print(f"Total en registro       : {len(registry)}")
    print(f"Productos en catalogo   : {len(catalog)}")
    print("\nFotos por referencia:")
    for p in PRODUCTS:
        print(f"  {p['sku']:8} {p['brand']:14} {p['name'][:32]:32} -> {len(photos_by_sku.get(p['sku'], []))} fotos")
    unsorted = photos_by_sku.get("UNSORTED", [])
    if unsorted:
        print(f"\n  SIN CLASIFICAR (UNSORTED): {len(unsorted)} fotos -> agrega su SKU en PHOTO_TO_SKU")


if __name__ == "__main__":
    main()
