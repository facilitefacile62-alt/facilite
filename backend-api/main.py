import os
import logging
import urllib.parse
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl, Field
from sqlalchemy.orm import Session
from sqlalchemy import or_

# Imports locaux
from database import init_db, get_db, Establishment, JobOffer
from scraper import scrape_real_data

# -------------------------------------------------------
# Initialisation de l'application FastAPI
# -------------------------------------------------------
app = FastAPI(
    title="Facilité – Backend API & Scraping Automation",
    version="0.2.0",
    description="Backend Python connecté à Supabase (PostgreSQL) avec automatisation de scraping par requête HTTP.",
)

# Configuration du middleware CORS pour permettre l'appel depuis le frontend Next.js (ex: localhost:3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"], # À restreindre en production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration du logging
logger = logging.getLogger("fastapi")
logger.setLevel(logging.INFO)
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("[fastapi] %(levelname)s – %(message)s"))
    logger.addHandler(handler)


# -------------------------------------------------------
# Événement au démarrage – initialiser la base de données
# -------------------------------------------------------
@app.on_event("startup")
def on_startup():
    try:
        init_db()
        logger.info("Connexion à Supabase et vérification des tables réussies.")
    except Exception as e:
        logger.error(f"Erreur d'initialisation de la base de données : {e}")


# -------------------------------------------------------
# Routes de vérification de santé (Health Check)
# -------------------------------------------------------
@app.get("/", tags=["Health"])
def read_root():
    return {"message": "🚀 Facilité FastAPI backend is up and running!"}


@app.get("/status", tags=["Health"])
def read_status():
    return {
        "status": "ok",
        "environment": os.getenv("ENV", "development"),
        "database_url": "configured" if os.getenv("SUPABASE_DATABASE_URL") else "missing",
    }


# -------------------------------------------------------
# Schémas de validation Pydantic
# -------------------------------------------------------
class EstablishmentCreate(BaseModel):
    name: str = Field(..., example="Hôpital Principal de Dakar")
    address: Optional[str] = Field(None, example="1, Avenue Nelson Mandela, Plateau")
    phone: Optional[str] = Field(None, example="+221 33 839 50 50")
    email: Optional[str] = Field(None, example="communication@hpd.sn")


class ScrapeRequest(BaseModel):
    target_url: str = Field(
        ..., 
        example="https://httpbin.org/html", 
        description="L'URL cible à scraper pour extraire les établissements ou offres."
    )


# -------------------------------------------------------
# Routes CRUD – Établissements
# -------------------------------------------------------
@app.post("/establishments", status_code=status.HTTP_201_CREATED, tags=["Establishments"])
def create_establishment(payload: EstablishmentCreate, db: Session = Depends(get_db)):
    existing = db.query(Establishment).filter(Establishment.name == payload.name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"L'établissement '{payload.name}' existe déjà."
        )
    
    est = Establishment(
        name=payload.name,
        address=payload.address,
        phone=payload.phone,
        email=payload.email,
    )
    db.add(est)
    db.commit()
    db.refresh(est)
    return {"status": "success", "data": {"id": est.id, "name": est.name}}


@app.get("/establishments", tags=["Establishments"])
def list_establishments(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    establishments = db.query(Establishment).offset(skip).limit(limit).all()
    return {
        "count": len(establishments),
        "data": [
            {
                "id": e.id, 
                "name": e.name, 
                "address": e.address, 
                "phone": e.phone, 
                "email": e.email
            }
            for e in establishments
        ]
    }


@app.get("/establishments/{name}", tags=["Establishments"])
def get_establishment(name: str, db: Session = Depends(get_db)):
    est = db.query(Establishment).filter(Establishment.name == name).first()
    if not est:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Établissement introuvable.")
    return {
        "id": est.id,
        "name": est.name,
        "address": est.address,
        "phone": est.phone,
        "email": est.email,
    }


# -------------------------------------------------------
# Route d'automatisation – Scraping & Sauvegarde DB
# -------------------------------------------------------
@app.post("/scrape-and-save", tags=["Scraping Automation"])
def trigger_scraping_from_url(payload: ScrapeRequest, db: Session = Depends(get_db)):
    """
    Déclenche le scraping sur une URL spécifique envoyée dans le body, 
    parse les données structurées et les enregistre automatiquement dans Supabase en évitant les doublons.
    """
    logger.info(f"Requête de scraping reçue pour : {payload.target_url}")
    raw_data_list = scrape_real_data(payload.target_url)
    
    saved_count = 0
    duplicate_count = 0
    errors: List[Dict[str, Any]] = []

    for item in raw_data_list:
        name = item.get("name")
        if not name or name.strip() == "":
            errors.append({"item": item, "error": "Nom de l'établissement manquant ou vide"})
            continue

        # Vérifier si l'établissement existe déjà en base pour éviter les doublons
        existing = db.query(Establishment).filter(Establishment.name == name).first()
        if existing:
            duplicate_count += 1
            continue  # Ignore le doublon

        try:
            est = Establishment(
                name=name,
                address=item.get("address"),
                phone=item.get("phone"),
                email=item.get("email"),
            )
            db.add(est)
            db.commit()
            saved_count += 1
        except Exception as e:
            db.rollback()
            errors.append({"name": name, "error": str(e)})

    return {
        "status": "success",
        "target_url": payload.target_url,
        "scraped_total": len(raw_data_list),
        "newly_saved": saved_count,
        "duplicates_ignored": duplicate_count,
        "errors": errors
    }


# -------------------------------------------------------
# Moteur de Recherche Global en Temps Réel (Offres & Spontané)
# -------------------------------------------------------
@app.get("/api/search", tags=["Global Search Engine"])
def search_global(q: str = "", limit: int = 10, db: Session = Depends(get_db)):
    """
    Recherche textuelle globale via ILIKE simultanément dans deux tables :
    1. `job_offers` (Offres d'emploi classiques)
    2. `establishments` (Entreprises issues du scraping pour candidatures spontanées)
    Retourne une liste combinée prête pour le dropdown du frontend Next.js.
    """
    if not q or not q.strip():
        return {"query": q, "total": 0, "results": []}

    search_term = f"%{q.strip().lower()}%"
    results = []

    # 1. Recherche dans la table des offres d'emploi classiques
    try:
        offers = db.query(JobOffer).filter(
            or_(
                JobOffer.title.ilike(search_term),
                JobOffer.company.ilike(search_term),
                JobOffer.location.ilike(search_term)
            )
        ).limit(limit).all()

        for off in offers:
            results.append({
                "id": f"offer_{off.id}",
                "raw_id": str(off.id),
                "title": off.title or "Offre d'emploi",
                "type": "Offre d'emploi",
                "subtitle": f"{off.company or 'Recruteur confidentiel'} • 📍 {off.location or 'Sénégal'} ({off.contract_type or 'CDI'})",
                "targetUrl": f"/offres?id={off.id}",
                "icon": "fa-briefcase",
                "badgeColor": "emerald"
            })
    except Exception as e:
        logger.error(f"Erreur lors de la recherche dans job_offers : {e}")

    # 2. Recherche dans la table des établissements scrappés pour candidature spontanée
    try:
        establishments = db.query(Establishment).filter(
            or_(
                Establishment.name.ilike(search_term),
                Establishment.address.ilike(search_term),
                Establishment.email.ilike(search_term)
            )
        ).limit(limit).all()

        for est in establishments:
            encoded_name = urllib.parse.quote(est.name)
            results.append({
                "id": f"est_{est.id}",
                "raw_id": str(est.id),
                "title": est.name,
                "type": "Entreprise (Candidature Spontanée)",
                "subtitle": f"📍 {est.address or 'Sénégal'} • 📧 {est.email or 'Contact direct'}",
                "targetUrl": f"/recrutement-spontane?entreprise={encoded_name}",
                "icon": "fa-building-user",
                "badgeColor": "blue"
            })
    except Exception as e:
        logger.error(f"Erreur lors de la recherche dans establishments : {e}")

    return {
        "query": q.strip(),
        "total": len(results),
        "results": results
    }

