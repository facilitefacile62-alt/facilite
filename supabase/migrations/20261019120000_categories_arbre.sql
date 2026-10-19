-- Arbre des catégories de « Publier un produit » (Locaux) et nouvelles informations d'article.
--
-- Prompt « Menu et Publier » (19/10/2026), § 3 : 9 catégories, leurs sous-catégories et leurs types, stockés EN BASE
-- (table categories : id, parent_id, libellé, icône, ordre) et non en dur dans l'application. 216 lignes.
--  - Lecture publique via la fonction lister_categories() : la table n'accorde aucun droit direct (pas de policy
--    « lisible par tous », refusée par l'invariant 7).
--  - marketplace_items reçoit la sous-catégorie, le type, l'état, la marque et la taille (écran « Détails »).
--  - La contrainte de catégorie accepte les nouvelles racines (sport, bebe, beaute, livres, autres) EN PLUS des anciennes :
--    les articles existants et le site ne changent pas.
--  - publier_mon_article reprend ses paramètres actuels et en ajoute cinq, facultatifs.

CREATE TABLE IF NOT EXISTS public.categories (
  id        TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES public.categories(id) ON DELETE CASCADE,
  libelle   TEXT NOT NULL,
  icone     TEXT NOT NULL DEFAULT '📦',
  ordre     INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_categories_parent ON public.categories(parent_id, ordre);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.categories FROM PUBLIC, anon, authenticated;

INSERT INTO public.categories (id, parent_id, libelle, icone, ordre) VALUES
  ('mode', NULL, 'Mode & Vêtements', '👕', 1),
  ('mode-femme', 'mode', 'Femme', '👜', 1),
  ('mode-femme-robes-jupes', 'mode-femme', 'Robes & Jupes', '👜', 1),
  ('mode-femme-hauts-tops', 'mode-femme', 'Hauts & Tops', '👜', 2),
  ('mode-femme-pantalons-jeans', 'mode-femme', 'Pantalons & Jeans', '👜', 3),
  ('mode-femme-boubous-tenues-traditionnelles', 'mode-femme', 'Boubous & Tenues traditionnelles', '👜', 4),
  ('mode-femme-chaussures-femme', 'mode-femme', 'Chaussures femme', '👜', 5),
  ('mode-homme', 'mode', 'Homme', '👔', 2),
  ('mode-homme-chemises-polos', 'mode-homme', 'Chemises & Polos', '👔', 1),
  ('mode-homme-pantalons-jeans', 'mode-homme', 'Pantalons & Jeans', '👔', 2),
  ('mode-homme-boubous-dashikis', 'mode-homme', 'Boubous & Dashikis', '👔', 3),
  ('mode-homme-costumes-vestes', 'mode-homme', 'Costumes & Vestes', '👔', 4),
  ('mode-homme-chaussures-homme', 'mode-homme', 'Chaussures homme', '👔', 5),
  ('mode-enfant', 'mode', 'Enfant', '🧒', 3),
  ('mode-enfant-fille-0-14-ans', 'mode-enfant', 'Fille 0-14 ans', '🧒', 1),
  ('mode-enfant-garcon-0-14-ans', 'mode-enfant', 'Garçon 0-14 ans', '🧒', 2),
  ('mode-enfant-bebe-0-2-ans', 'mode-enfant', 'Bébé 0-2 ans', '🧒', 3),
  ('mode-enfant-chaussures-enfant', 'mode-enfant', 'Chaussures enfant', '🧒', 4),
  ('mode-enfant-uniformes-scolaires', 'mode-enfant', 'Uniformes scolaires', '🧒', 5),
  ('mode-tissu-wax', 'mode', 'Tissu & Wax', '✂️', 4),
  ('mode-tissu-wax-wax-africain', 'mode-tissu-wax', 'Wax africain', '✂️', 1),
  ('mode-tissu-wax-bazin-riche', 'mode-tissu-wax', 'Bazin riche', '✂️', 2),
  ('mode-tissu-wax-dentelle-broderie', 'mode-tissu-wax', 'Dentelle & Broderie', '✂️', 3),
  ('mode-tissu-wax-soie-satin', 'mode-tissu-wax', 'Soie & Satin', '✂️', 4),
  ('mode-tissu-wax-tricot-jersey', 'mode-tissu-wax', 'Tricot & Jersey', '✂️', 5),
  ('mode-bijoux-accessoires', 'mode', 'Bijoux & Accessoires', '💎', 5),
  ('mode-bijoux-accessoires-bijoux-fantaisie', 'mode-bijoux-accessoires', 'Bijoux fantaisie', '💎', 1),
  ('mode-bijoux-accessoires-montres', 'mode-bijoux-accessoires', 'Montres', '💎', 2),
  ('mode-bijoux-accessoires-sacs-pochettes', 'mode-bijoux-accessoires', 'Sacs & Pochettes', '💎', 3),
  ('mode-bijoux-accessoires-lunettes', 'mode-bijoux-accessoires', 'Lunettes', '💎', 4),
  ('mode-bijoux-accessoires-ceintures-bretelles', 'mode-bijoux-accessoires', 'Ceintures & Bretelles', '💎', 5),
  ('electronique', NULL, 'Électronique', '🔌', 2),
  ('electronique-telephones', 'electronique', 'Téléphones', '📱', 1),
  ('electronique-telephones-smartphones', 'electronique-telephones', 'Smartphones', '📱', 1),
  ('electronique-telephones-telephones-basiques', 'electronique-telephones', 'Téléphones basiques', '📱', 2),
  ('electronique-telephones-accessoires-telephone', 'electronique-telephones', 'Accessoires téléphone', '📱', 3),
  ('electronique-informatique', 'electronique', 'Informatique', '💻', 2),
  ('electronique-informatique-ordinateurs-portables', 'electronique-informatique', 'Ordinateurs portables', '💻', 1),
  ('electronique-informatique-pc-de-bureau', 'electronique-informatique', 'PC de bureau', '💻', 2),
  ('electronique-informatique-tablettes', 'electronique-informatique', 'Tablettes', '💻', 3),
  ('electronique-informatique-accessoires-informatique', 'electronique-informatique', 'Accessoires informatique', '💻', 4),
  ('electronique-informatique-imprimantes', 'electronique-informatique', 'Imprimantes', '💻', 5),
  ('electronique-tv-audio', 'electronique', 'TV & Audio', '📺', 3),
  ('electronique-electromenager', 'electronique', 'Électroménager', '🧊', 4),
  ('electronique-electromenager-refrigerateurs-congelateurs', 'electronique-electromenager', 'Réfrigérateurs & Congélateurs', '🧊', 1),
  ('electronique-electromenager-climatiseurs-ventilateurs', 'electronique-electromenager', 'Climatiseurs & Ventilateurs', '🧊', 2),
  ('electronique-electromenager-machines-a-laver', 'electronique-electromenager', 'Machines à laver', '🧊', 3),
  ('electronique-electromenager-cuisinieres-fours', 'electronique-electromenager', 'Cuisinières & Fours', '🧊', 4),
  ('electronique-electromenager-petits-appareils', 'electronique-electromenager', 'Petits appareils', '🧊', 5),
  ('electronique-photo-video', 'electronique', 'Photo & Vidéo', '📷', 5),
  ('electronique-photo-video-appareils-photo', 'electronique-photo-video', 'Appareils photo', '📷', 1),
  ('electronique-photo-video-cameras-camescopes', 'electronique-photo-video', 'Caméras & Camescopes', '📷', 2),
  ('electronique-photo-video-drones', 'electronique-photo-video', 'Drones', '📷', 3),
  ('electronique-photo-video-accessoires-objectifs', 'electronique-photo-video', 'Accessoires & Objectifs', '📷', 4),
  ('maison', NULL, 'Maison & Déco', '🏠', 3),
  ('maison-meubles', 'maison', 'Meubles', '🛋️', 1),
  ('maison-meubles-canapes-salons', 'maison-meubles', 'Canapés & Salons', '🛋️', 1),
  ('maison-meubles-chambres-a-coucher', 'maison-meubles', 'Chambres à coucher', '🛋️', 2),
  ('maison-meubles-tables-chaises', 'maison-meubles', 'Tables & Chaises', '🛋️', 3),
  ('maison-meubles-meubles-de-bureau', 'maison-meubles', 'Meubles de bureau', '🛋️', 4),
  ('maison-meubles-armoires-rangement', 'maison-meubles', 'Armoires & Rangement', '🛋️', 5),
  ('maison-decoration', 'maison', 'Décoration', '🖼️', 2),
  ('maison-decoration-tableaux-art', 'maison-decoration', 'Tableaux & Art', '🖼️', 1),
  ('maison-decoration-tapis-rideaux', 'maison-decoration', 'Tapis & Rideaux', '🖼️', 2),
  ('maison-decoration-luminaires-lampes', 'maison-decoration', 'Luminaires & Lampes', '🖼️', 3),
  ('maison-decoration-coussins-linge-de-maison', 'maison-decoration', 'Coussins & Linge de maison', '🖼️', 4),
  ('maison-decoration-vases-bougies', 'maison-decoration', 'Vases & Bougies', '🖼️', 5),
  ('maison-cuisine-table', 'maison', 'Cuisine & Table', '🍽️', 3),
  ('maison-cuisine-table-vaisselle-arts-de-table', 'maison-cuisine-table', 'Vaisselle & Arts de table', '🍽️', 1),
  ('maison-cuisine-table-ustensiles-de-cuisine', 'maison-cuisine-table', 'Ustensiles de cuisine', '🍽️', 2),
  ('maison-cuisine-table-appareils-de-cuisson', 'maison-cuisine-table', 'Appareils de cuisson', '🍽️', 3),
  ('maison-cuisine-table-conservation-stockage', 'maison-cuisine-table', 'Conservation & Stockage', '🍽️', 4),
  ('maison-jardin-exterieur', 'maison', 'Jardin & Extérieur', '🌿', 4),
  ('maison-jardin-exterieur-mobilier-exterieur', 'maison-jardin-exterieur', 'Mobilier extérieur', '🌿', 1),
  ('maison-jardin-exterieur-outils-de-jardinage', 'maison-jardin-exterieur', 'Outils de jardinage', '🌿', 2),
  ('maison-jardin-exterieur-plantes-graines', 'maison-jardin-exterieur', 'Plantes & Graines', '🌿', 3),
  ('maison-jardin-exterieur-piscines-jeux', 'maison-jardin-exterieur', 'Piscines & Jeux', '🌿', 4),
  ('maison-bricolage', 'maison', 'Bricolage', '🔧', 5),
  ('maison-bricolage-electricite', 'maison-bricolage', 'Électricité', '🔧', 1),
  ('maison-bricolage-plomberie', 'maison-bricolage', 'Plomberie', '🔧', 2),
  ('maison-bricolage-peinture-revetements', 'maison-bricolage', 'Peinture & Revêtements', '🔧', 3),
  ('maison-bricolage-outils-machines', 'maison-bricolage', 'Outils & Machines', '🔧', 4),
  ('maison-bricolage-panneaux-solaires', 'maison-bricolage', 'Panneaux solaires', '🔧', 5),
  ('sport', NULL, 'Sport & Loisirs', '🏆', 4),
  ('sport-football', 'sport', 'Football', '⚽', 1),
  ('sport-football-ballons', 'sport-football', 'Ballons', '⚽', 1),
  ('sport-football-maillots-shorts', 'sport-football', 'Maillots & Shorts', '⚽', 2),
  ('sport-football-chaussures-de-foot', 'sport-football', 'Chaussures de foot', '⚽', 3),
  ('sport-football-equipements-filets', 'sport-football', 'Équipements & Filets', '⚽', 4),
  ('sport-fitness-musculation', 'sport', 'Fitness & Musculation', '🏋️', 2),
  ('sport-fitness-musculation-halteres-musculation', 'sport-fitness-musculation', 'Haltères & Musculation', '🏋️', 1),
  ('sport-fitness-musculation-cardio-machines', 'sport-fitness-musculation', 'Cardio & Machines', '🏋️', 2),
  ('sport-fitness-musculation-yoga-pilates', 'sport-fitness-musculation', 'Yoga & Pilates', '🏋️', 3),
  ('sport-fitness-musculation-nutrition-sportive', 'sport-fitness-musculation', 'Nutrition sportive', '🏋️', 4),
  ('sport-fitness-musculation-boxe-arts-martiaux', 'sport-fitness-musculation', 'Boxe & Arts martiaux', '🏋️', 5),
  ('sport-sports-collectifs', 'sport', 'Sports collectifs', '🏀', 3),
  ('sport-sports-collectifs-basketball', 'sport-sports-collectifs', 'Basketball', '🏀', 1),
  ('sport-sports-collectifs-volleyball', 'sport-sports-collectifs', 'Volleyball', '🏀', 2),
  ('sport-sports-collectifs-handball', 'sport-sports-collectifs', 'Handball', '🏀', 3),
  ('sport-sports-collectifs-tennis-badminton', 'sport-sports-collectifs', 'Tennis & Badminton', '🏀', 4),
  ('sport-jeux-jouets', 'sport', 'Jeux & Jouets', '🧩', 4),
  ('sport-jeux-jouets-jeux-de-societe', 'sport-jeux-jouets', 'Jeux de société', '🧩', 1),
  ('sport-jeux-jouets-jouets-educatifs', 'sport-jeux-jouets', 'Jouets éducatifs', '🧩', 2),
  ('sport-jeux-jouets-jeux-video-consoles', 'sport-jeux-jouets', 'Jeux vidéo & Consoles', '🧩', 3),
  ('sport-jeux-jouets-jouets-plein-air', 'sport-jeux-jouets', 'Jouets plein air', '🧩', 4),
  ('sport-musique-instruments', 'sport', 'Musique & Instruments', '🎸', 5),
  ('sport-musique-instruments-guitares-basses', 'sport-musique-instruments', 'Guitares & Basses', '🎸', 1),
  ('sport-musique-instruments-percussions-africaines', 'sport-musique-instruments', 'Percussions africaines', '🎸', 2),
  ('sport-musique-instruments-claviers-piano', 'sport-musique-instruments', 'Claviers & Piano', '🎸', 3),
  ('sport-musique-instruments-materiel-dj-studio', 'sport-musique-instruments', 'Matériel DJ & Studio', '🎸', 4),
  ('sport-musique-instruments-instruments-a-vent', 'sport-musique-instruments', 'Instruments à vent', '🎸', 5),
  ('bebe', NULL, 'Bébé & Enfants', '🍼', 5),
  ('bebe-puericulture', 'bebe', 'Puériculture', '🍼', 1),
  ('bebe-puericulture-poussettes-landaus', 'bebe-puericulture', 'Poussettes & Landaus', '🍼', 1),
  ('bebe-puericulture-sieges-auto-bebe', 'bebe-puericulture', 'Sièges auto bébé', '🍼', 2),
  ('bebe-puericulture-porte-bebe-echarpes', 'bebe-puericulture', 'Porte-bébé & Écharpes', '🍼', 3),
  ('bebe-puericulture-baignoires-soins', 'bebe-puericulture', 'Baignoires & Soins', '🍼', 4),
  ('bebe-vetements-bebe', 'bebe', 'Vêtements bébé', '👶', 2),
  ('bebe-vetements-bebe-0-6-mois', 'bebe-vetements-bebe', '0-6 mois', '👶', 1),
  ('bebe-vetements-bebe-6-mois-2-ans', 'bebe-vetements-bebe', '6 mois - 2 ans', '👶', 2),
  ('bebe-vetements-bebe-2-5-ans', 'bebe-vetements-bebe', '2-5 ans', '👶', 3),
  ('bebe-vetements-bebe-chapeaux-accessoires', 'bebe-vetements-bebe', 'Chapeaux & Accessoires', '👶', 4),
  ('bebe-jouets-eveil', 'bebe', 'Jouets & Éveil', '🧸', 3),
  ('bebe-jouets-eveil-eveil-0-12-mois', 'bebe-jouets-eveil', 'Éveil 0-12 mois', '🧸', 1),
  ('bebe-jouets-eveil-jouets-1-3-ans', 'bebe-jouets-eveil', 'Jouets 1-3 ans', '🧸', 2),
  ('bebe-jouets-eveil-jouets-3-6-ans', 'bebe-jouets-eveil', 'Jouets 3-6 ans', '🧸', 3),
  ('bebe-jouets-eveil-peluches-doudous', 'bebe-jouets-eveil', 'Peluches & Doudous', '🧸', 4),
  ('bebe-chambre-bebe', 'bebe', 'Chambre bébé', '🛏️', 4),
  ('bebe-chambre-bebe-lits-berceaux', 'bebe-chambre-bebe', 'Lits & Berceaux', '🛏️', 1),
  ('bebe-chambre-bebe-matelas-literie', 'bebe-chambre-bebe', 'Matelas & Literie', '🛏️', 2),
  ('bebe-chambre-bebe-mobilier-nursery', 'bebe-chambre-bebe', 'Mobilier nursery', '🛏️', 3),
  ('bebe-chambre-bebe-securite-maison', 'bebe-chambre-bebe', 'Sécurité maison', '🛏️', 4),
  ('beaute', NULL, 'Beauté & Santé', '🧴', 6),
  ('beaute-visage', 'beaute', 'Visage', '🧴', 1),
  ('beaute-visage-cremes-hydratants', 'beaute-visage', 'Crèmes & Hydratants', '🧴', 1),
  ('beaute-visage-maquillage', 'beaute-visage', 'Maquillage', '🧴', 2),
  ('beaute-visage-soins-anti-taches', 'beaute-visage', 'Soins anti-taches', '🧴', 3),
  ('beaute-visage-nettoyants-toniques', 'beaute-visage', 'Nettoyants & Toniques', '🧴', 4),
  ('beaute-corps', 'beaute', 'Corps', '🧼', 2),
  ('beaute-corps-hydratation-corps', 'beaute-corps', 'Hydratation corps', '🧼', 1),
  ('beaute-corps-gommages-exfoliants', 'beaute-corps', 'Gommages & Exfoliants', '🧼', 2),
  ('beaute-corps-epilation', 'beaute-corps', 'Épilation', '🧼', 3),
  ('beaute-corps-deodorants', 'beaute-corps', 'Déodorants', '🧼', 4),
  ('beaute-cheveux', 'beaute', 'Cheveux', '💇', 3),
  ('beaute-cheveux-shampooings-soins', 'beaute-cheveux', 'Shampooings & Soins', '💇', 1),
  ('beaute-cheveux-perruques-extensions', 'beaute-cheveux', 'Perruques & Extensions', '💇', 2),
  ('beaute-cheveux-tresses-tissages', 'beaute-cheveux', 'Tresses & Tissages', '💇', 3),
  ('beaute-cheveux-huiles-capillaires', 'beaute-cheveux', 'Huiles capillaires', '💇', 4),
  ('beaute-parfums-senteurs', 'beaute', 'Parfums & Senteurs', '🌸', 4),
  ('beaute-parfums-senteurs-parfums-femme', 'beaute-parfums-senteurs', 'Parfums femme', '🌸', 1),
  ('beaute-parfums-senteurs-parfums-homme', 'beaute-parfums-senteurs', 'Parfums homme', '🌸', 2),
  ('beaute-parfums-senteurs-huiles-parfumees', 'beaute-parfums-senteurs', 'Huiles parfumées', '🌸', 3),
  ('beaute-parfums-senteurs-encens-diffuseurs', 'beaute-parfums-senteurs', 'Encens & Diffuseurs', '🌸', 4),
  ('beaute-sante-bien-etre', 'beaute', 'Santé & Bien-être', '💊', 5),
  ('beaute-sante-bien-etre-complements-alimentaires', 'beaute-sante-bien-etre', 'Compléments alimentaires', '💊', 1),
  ('beaute-sante-bien-etre-materiel-medical', 'beaute-sante-bien-etre', 'Matériel médical', '💊', 2),
  ('beaute-sante-bien-etre-bien-etre-massage', 'beaute-sante-bien-etre', 'Bien-être & Massage', '💊', 3),
  ('beaute-sante-bien-etre-optique-lunettes', 'beaute-sante-bien-etre', 'Optique & Lunettes', '💊', 4),
  ('livres', NULL, 'Livres & Éducation', '📚', 7),
  ('livres-livres-romans', 'livres', 'Livres & Romans', '📖', 1),
  ('livres-livres-romans-litterature-africaine', 'livres-livres-romans', 'Littérature africaine', '📖', 1),
  ('livres-livres-romans-litterature-mondiale', 'livres-livres-romans', 'Littérature mondiale', '📖', 2),
  ('livres-livres-romans-policiers-thrillers', 'livres-livres-romans', 'Policiers & Thrillers', '📖', 3),
  ('livres-livres-romans-bd-mangas', 'livres-livres-romans', 'BD & Mangas', '📖', 4),
  ('livres-formations', 'livres', 'Formations', '🎓', 2),
  ('livres-formations-langues-etrangeres', 'livres-formations', 'Langues étrangères', '🎓', 1),
  ('livres-formations-informatique-tech', 'livres-formations', 'Informatique & Tech', '🎓', 2),
  ('livres-formations-commerce-finance', 'livres-formations', 'Commerce & Finance', '🎓', 3),
  ('livres-formations-sante-paramedical', 'livres-formations', 'Santé & Paramédical', '🎓', 4),
  ('livres-fournitures-scolaires', 'livres', 'Fournitures scolaires', '✏️', 3),
  ('livres-fournitures-scolaires-primaire', 'livres-fournitures-scolaires', 'Primaire', '✏️', 1),
  ('livres-fournitures-scolaires-college-lycee', 'livres-fournitures-scolaires', 'Collège & Lycée', '✏️', 2),
  ('livres-fournitures-scolaires-superieur-universite', 'livres-fournitures-scolaires', 'Supérieur & Université', '✏️', 3),
  ('livres-fournitures-scolaires-fournitures-papeterie', 'livres-fournitures-scolaires', 'Fournitures & Papeterie', '✏️', 4),
  ('livres-religion-spiritualite', 'livres', 'Religion & Spiritualité', '🕌', 4),
  ('livres-religion-spiritualite-islam-coran', 'livres-religion-spiritualite', 'Islam & Coran', '🕌', 1),
  ('livres-religion-spiritualite-christianisme-bible', 'livres-religion-spiritualite', 'Christianisme & Bible', '🕌', 2),
  ('livres-religion-spiritualite-spiritualite-africaine', 'livres-religion-spiritualite', 'Spiritualité africaine', '🕌', 3),
  ('livres-business-entrepreneuriat', 'livres', 'Business & Entrepreneuriat', '💼', 5),
  ('livres-business-entrepreneuriat-entrepreneuriat', 'livres-business-entrepreneuriat', 'Entrepreneuriat', '💼', 1),
  ('livres-business-entrepreneuriat-management-leadership', 'livres-business-entrepreneuriat', 'Management & Leadership', '💼', 2),
  ('livres-business-entrepreneuriat-finance-investissement', 'livres-business-entrepreneuriat', 'Finance & Investissement', '💼', 3),
  ('livres-business-entrepreneuriat-marketing-vente', 'livres-business-entrepreneuriat', 'Marketing & Vente', '💼', 4),
  ('autres', NULL, 'Autres', '📦', 8),
  ('autres-collection-vintage', 'autres', 'Collection & Vintage', '🏺', 1),
  ('autres-animaux-accessoires', 'autres', 'Animaux & Accessoires', '🐾', 2),
  ('autres-materiel-professionnel', 'autres', 'Matériel professionnel', '🛠️', 3),
  ('autres-divers', 'autres', 'Divers', '🎁', 4),
  ('vehicules', NULL, 'Véhicules', '🚗', 9),
  ('vehicules-voitures', 'vehicules', 'Voitures', '🚗', 1),
  ('vehicules-voitures-citadines', 'vehicules-voitures', 'Citadines', '🚗', 1),
  ('vehicules-voitures-berlines', 'vehicules-voitures', 'Berlines', '🚗', 2),
  ('vehicules-voitures-suv-4-4', 'vehicules-voitures', 'SUV / 4×4', '🚗', 3),
  ('vehicules-voitures-pick-up', 'vehicules-voitures', 'Pick-up', '🚗', 4),
  ('vehicules-voitures-minibus', 'vehicules-voitures', 'Minibus', '🚗', 5),
  ('vehicules-voitures-luxe-sport', 'vehicules-voitures', 'Luxe & Sport', '🚗', 6),
  ('vehicules-motos-scooters', 'vehicules', 'Motos & Scooters', '🏍️', 2),
  ('vehicules-motos-scooters-motos', 'vehicules-motos-scooters', 'Motos', '🏍️', 1),
  ('vehicules-motos-scooters-scooters', 'vehicules-motos-scooters', 'Scooters', '🏍️', 2),
  ('vehicules-motos-scooters-tricycles', 'vehicules-motos-scooters', 'Tricycles', '🏍️', 3),
  ('vehicules-camions-utilitaires', 'vehicules', 'Camions & Utilitaires', '🚚', 3),
  ('vehicules-camions-utilitaires-camions', 'vehicules-camions-utilitaires', 'Camions', '🚚', 1),
  ('vehicules-camions-utilitaires-bus-transport', 'vehicules-camions-utilitaires', 'Bus & Transport', '🚚', 2),
  ('vehicules-camions-utilitaires-remorques', 'vehicules-camions-utilitaires', 'Remorques', '🚚', 3),
  ('vehicules-camions-utilitaires-engins-tp', 'vehicules-camions-utilitaires', 'Engins TP', '🚚', 4),
  ('vehicules-pieces-detachees', 'vehicules', 'Pièces détachées', '⚙️', 4),
  ('vehicules-pieces-detachees-moteur-boite', 'vehicules-pieces-detachees', 'Moteur & Boîte', '⚙️', 1),
  ('vehicules-pieces-detachees-carrosserie', 'vehicules-pieces-detachees', 'Carrosserie', '⚙️', 2),
  ('vehicules-pieces-detachees-electricite-auto', 'vehicules-pieces-detachees', 'Électricité auto', '⚙️', 3),
  ('vehicules-pieces-detachees-pneus-jantes', 'vehicules-pieces-detachees', 'Pneus & Jantes', '⚙️', 4),
  ('vehicules-pieces-detachees-pieces-diverses', 'vehicules-pieces-detachees', 'Pièces diverses', '⚙️', 5),
  ('vehicules-accessoires-auto', 'vehicules', 'Accessoires auto', '🎧', 5),
  ('vehicules-accessoires-auto-audio-gps', 'vehicules-accessoires-auto', 'Audio & GPS', '🎧', 1),
  ('vehicules-accessoires-auto-securite', 'vehicules-accessoires-auto', 'Sécurité', '🎧', 2),
  ('vehicules-accessoires-auto-entretien', 'vehicules-accessoires-auto', 'Entretien', '🎧', 3),
  ('vehicules-accessoires-auto-tuning-style', 'vehicules-accessoires-auto', 'Tuning & Style', '🎧', 4)
ON CONFLICT (id) DO UPDATE SET parent_id = EXCLUDED.parent_id, libelle = EXCLUDED.libelle, icone = EXCLUDED.icone, ordre = EXCLUDED.ordre;

CREATE OR REPLACE FUNCTION public.lister_categories()
RETURNS TABLE (id TEXT, parent_id TEXT, libelle TEXT, icone TEXT, ordre INTEGER)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT c.id, c.parent_id, c.libelle, c.icone, c.ordre FROM public.categories c ORDER BY c.ordre, c.libelle;
$$;

REVOKE ALL ON FUNCTION public.lister_categories() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lister_categories() TO anon, authenticated;

-- Nouvelles informations d'article
ALTER TABLE public.marketplace_items
  ADD COLUMN IF NOT EXISTS sous_categorie TEXT,
  ADD COLUMN IF NOT EXISTS type_article   TEXT,
  ADD COLUMN IF NOT EXISTS etat           TEXT,
  ADD COLUMN IF NOT EXISTS marque         TEXT,
  ADD COLUMN IF NOT EXISTS taille         TEXT;

ALTER TABLE public.marketplace_items DROP CONSTRAINT IF EXISTS marketplace_items_etat_check;
ALTER TABLE public.marketplace_items ADD CONSTRAINT marketplace_items_etat_check
  CHECK (etat IS NULL OR etat IN ('neuf', 'comme_neuf', 'bon_etat', 'a_reparer'));

ALTER TABLE public.marketplace_items DROP CONSTRAINT IF EXISTS marketplace_items_categorie_check;
ALTER TABLE public.marketplace_items ADD CONSTRAINT marketplace_items_categorie_check
  CHECK (categorie IN (
    'telephones', 'vehicules', 'immobilier', 'mode', 'maison',
    'electronique', 'informatique', 'services', 'alimentation', 'autre',
    'sport', 'bebe', 'beaute', 'livres', 'autres'
  ));

-- publier_mon_article : mêmes paramètres qu'avant, plus cinq facultatifs (sous-catégorie, type, état, marque, taille).
DROP FUNCTION IF EXISTS public.publier_mon_article(UUID, TEXT, TEXT, INTEGER, INTEGER, TEXT, JSONB, TEXT);

CREATE OR REPLACE FUNCTION public.publier_mon_article(
  p_store_id UUID,
  p_titre TEXT,
  p_categorie TEXT,
  p_prix INTEGER,
  p_quantite INTEGER DEFAULT 0,
  p_description TEXT DEFAULT NULL,
  p_photos JSONB DEFAULT '[]'::jsonb,
  p_url_video TEXT DEFAULT NULL,
  p_sous_categorie TEXT DEFAULT NULL,
  p_type_article TEXT DEFAULT NULL,
  p_etat TEXT DEFAULT NULL,
  p_marque TEXT DEFAULT NULL,
  p_taille TEXT DEFAULT NULL
)
RETURNS public.marketplace_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_moi UUID := auth.uid();
  v_row public.marketplace_items;
BEGIN
  IF v_moi IS NULL THEN RAISE EXCEPTION 'Connexion requise.'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.marketplace_stores s
    WHERE s.id = p_store_id AND s.owner_id = v_moi
  ) THEN
    RAISE EXCEPTION 'Boutique introuvable ou qui ne vous appartient pas.';
  END IF;

  -- La sous-catégorie et le type, quand ils sont fournis, doivent exister dans l'arbre (et dans la bonne branche).
  IF nullif(btrim(coalesce(p_sous_categorie, '')), '') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.categories c WHERE c.id = p_sous_categorie AND c.parent_id = p_categorie
  ) THEN
    RAISE EXCEPTION 'Sous-catégorie invalide.';
  END IF;
  IF nullif(btrim(coalesce(p_type_article, '')), '') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.categories c WHERE c.id = p_type_article AND c.parent_id = p_sous_categorie
  ) THEN
    RAISE EXCEPTION 'Type invalide.';
  END IF;

  INSERT INTO public.marketplace_items
    (store_id, titre, description, categorie, prix_xof, quantite, photos, url_video,
     sous_categorie, type_article, etat, marque, taille)
  VALUES (
    p_store_id, btrim(p_titre),
    nullif(btrim(coalesce(p_description, '')), ''),
    p_categorie,
    greatest(0, coalesce(p_prix, 0)),
    greatest(0, coalesce(p_quantite, 0)),
    coalesce(p_photos, '[]'::jsonb),
    nullif(btrim(coalesce(p_url_video, '')), ''),
    nullif(btrim(coalesce(p_sous_categorie, '')), ''),
    nullif(btrim(coalesce(p_type_article, '')), ''),
    nullif(btrim(coalesce(p_etat, '')), ''),
    left(nullif(btrim(coalesce(p_marque, '')), ''), 60),
    left(nullif(btrim(coalesce(p_taille, '')), ''), 30)
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.publier_mon_article(UUID, TEXT, TEXT, INTEGER, INTEGER, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publier_mon_article(UUID, TEXT, TEXT, INTEGER, INTEGER, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

