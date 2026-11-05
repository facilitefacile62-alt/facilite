# Extrait de l'Overture Maps (thème « buildings », ODbL) les empreintes de bâtiments autour des groupes de boutiques de Locaux, pour le prototype de la carte 3D.
# Usage : python scripts/carte3d/extraire-batiments.py  (nécessite : pip install duckdb ; accès réseau à s3://overturemaps-us-west-2, anonyme)
# Sortie : public/carte3d/batiments.geojson — propriétés minimales : h = hauteur d'extrusion en mètres (hauteur connue, sinon estimée de façon déterministe à partir de la surface).
# Les positions des groupes sont des centres de QUARTIERS arrondis à 3 décimales (environ 100 m), jamais des coordonnées exactes de boutique.
import json, math, hashlib, sys, duckdb

RELEASE = "2026-10-21.0"
RAYON_DEG = 0.0045  # environ 500 m
CENTRES = [(14.756, -17.384), (14.777, -17.350), (14.789, -17.339), (14.770, -17.310), (14.725, -17.458), (14.761, -16.934)]

con = duckdb.connect()
con.execute("INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial; SET s3_region='us-west-2';")
src = f"read_parquet('s3://overturemaps-us-west-2/release/{RELEASE}/theme=buildings/type=building/*', hive_partitioning=1)"
vus, features = set(), []
for lat, lng in CENTRES:
    lignes = con.execute(
        f"""select id, height, num_floors, ST_AsGeoJSON(ST_SimplifyPreserveTopology(geometry, 0.00001)) as g,
                   (bbox.xmax-bbox.xmin)*(bbox.ymax-bbox.ymin)*111320*111320*cos(radians({lat})) as m2
            from {src}
            where bbox.xmin between {lng-RAYON_DEG} and {lng+RAYON_DEG} and bbox.ymin between {lat-RAYON_DEG} and {lat+RAYON_DEG}"""
    ).fetchall()
    for id_, hauteur, etages, g, m2 in lignes:
        if id_ in vus:
            continue
        vus.add(id_)
        geom = json.loads(g)
        if geom["type"] not in ("Polygon", "MultiPolygon"):
            continue
        def arrondir(c):
            return [round(c[0], 5), round(c[1], 5)] if isinstance(c[0], (int, float)) else [arrondir(x) for x in c]
        geom["coordinates"] = arrondir(geom["coordinates"])
        if hauteur:
            h = float(hauteur)
        elif etages:
            h = 3.2 * float(etages)
        else:
            # Hauteur inconnue (cas général à Dakar) : estimation déterministe — 5 à 9 m selon l'identifiant, un peu plus haut pour les grands volumes.
            alea = int(hashlib.md5(id_.encode()).hexdigest()[:4], 16) / 65535
            h = 5 + 4 * alea + min(6, max(0, (m2 - 150) / 120))
        features.append({"type": "Feature", "properties": {"h": round(h, 1)}, "geometry": geom})
    print(f"centre {lat},{lng} : {len(lignes)} bâtiments lus, total retenu {len(features)}", file=sys.stderr)

sortie = {"type": "FeatureCollection", "features": features}
with open("public/carte3d/batiments.geojson", "w", encoding="utf-8") as f:
    json.dump(sortie, f, separators=(",", ":"))
print("écrit public/carte3d/batiments.geojson :", len(features), "bâtiments", file=sys.stderr)
