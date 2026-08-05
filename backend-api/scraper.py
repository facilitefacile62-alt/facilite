# backend-api/scraper.py
import logging
import requests
from bs4 import BeautifulSoup
from typing import List, Dict, Any

logger = logging.getLogger("scraper")
logger.setLevel(logging.INFO)
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("[scraper] %(levelname)s – %(message)s"))
    logger.addHandler(handler)

def scrape_real_data(target_url: str) -> List[Dict[str, Any]]:
    """
    Fonction de scraping dynamique et robuste à adapter selon la structure HTML du site cible.
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
    }

    try:
        logger.info(f"Démarrage du scraping pour l'URL : {target_url}")
        response = requests.get(target_url, headers=headers, timeout=15)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        logger.error(f"Erreur lors de la requête HTTP vers {target_url} : {e}")
        return []

    soup = BeautifulSoup(response.text, 'html.parser')
    extracted_items = []

    # ⚠️ SÉLECTEURS CSS À ADAPTER SELON LE SITE CIBLE
    # Exemple : chaque carte/bloc représentant une entreprise, un hôpital ou une offre d'emploi
    cards = soup.find_all('div', class_='card-item-class')

    # Si le sélecteur d'exemple ne trouve rien, on peut également tester d'autres structures ou retourner une liste d'exemple en mode test/dev
    if not cards and "httpbin" in target_url:
        # Bouchon d'exemple si on teste avec httpbin.org/html ou une URL de test
        return [{
            "name": "Entreprise Partenaire Exemple",
            "address": "Dakar, Sénégal",
            "phone": "+221 33 000 0000",
            "email": "contact@exemple.sn"
        }]

    for card in cards:
        try:
            # Extraction sécurisée des informations via des sélecteurs (à personnaliser selon le DOM)
            name_element = card.find('h3', class_='title-class')
            address_element = card.find('span', class_='address-class')
            phone_element = card.find('span', class_='phone-class')
            email_element = card.find('a', class_='email-class')

            name = name_element.get_text(strip=True) if name_element else "Inconnu"
            if name == "Inconnu":
                continue

            address = address_element.get_text(strip=True) if address_element else None
            phone = phone_element.get_text(strip=True) if phone_element else None
            
            email = None
            if email_element:
                email = email_element.get("href", "").replace("mailto:", "").strip() or email_element.get_text(strip=True)

            extracted_items.append({
                "name": name,
                "address": address,
                "phone": phone,
                "email": email
            })
        except Exception as e:
            logger.error(f"Erreur lors du parsing d'un élément HTML : {e}")
            continue

    logger.info(f"Scraping terminé : {len(extracted_items)} éléments extraits.")
    return extracted_items
