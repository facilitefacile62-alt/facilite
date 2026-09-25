// Vraies infrastructures de transport public de Dakar (BRT, TER) — pas des
// boutiques Facilité : personne ne "crée" une station de bus ou une gare sur
// la plateforme, donc ces points n'ont rien à faire dans marketplace_stores
// (pas de owner_id, pas de vérification, pas de RLS applicable). Couche de
// référence statique, affichée telle quelle sur la carte Marketplace pour
// que l'utilisateur situe ces repères connus (demande explicite : "montre
// leur position visiblement dans la carte exemple la BRT et TER").
//
// Coordonnées et noms de gares/stations réels, sourcés d'un jeu de données
// GTFS communautaire (CETUD brochure + Senego + Wikipedia BRT Dakar) —
// jamais inventés. 23 stations SunuBRT (Petersen ↔ Guédiawaye), 13 gares TER
// (Dakar ↔ Diamniadio, phase 1 — l'extension AIBD n'est pas encore en
// service). Couleurs = vraies couleurs de ligne (BRT violet, TER vert), pas
// choisies arbitrairement.

export const COULEUR_BRT = "#8B5CF6";
export const COULEUR_TER = "#10B981";

export const STATIONS_BRT = [
  { id: "BRT_01", nom: "Papa Gueye Fall - PEM Petersen", lat: 14.67548, lng: -17.44157 },
  { id: "BRT_02", nom: "Grande Mosquée", lat: 14.67822, lng: -17.44219 },
  { id: "BRT_03", nom: "Place de la Nation - Obélisque", lat: 14.6943, lng: -17.44826 },
  { id: "BRT_04", nom: "Dial Diop", lat: 14.69956, lng: -17.45244 },
  { id: "BRT_05", nom: "Grand Dakar", lat: 14.7052, lng: -17.4578 },
  { id: "BRT_06", nom: "Liberté 1", lat: 14.70993, lng: -17.4625 },
  { id: "BRT_07", nom: "Sacré-Cœur", lat: 14.7166, lng: -17.4635 },
  { id: "BRT_08", nom: "Liberté 5", lat: 14.72044, lng: -17.46444 },
  { id: "BRT_09", nom: "Liberté 6", lat: 14.72631, lng: -17.45919 },
  { id: "BRT_10", nom: "Khar Yallah", lat: 14.7315, lng: -17.456 },
  { id: "BRT_11", nom: "Scat Urbam", lat: 14.73681, lng: -17.45531 },
  { id: "BRT_12", nom: "Cardinal Hyacinthe Thiandoum", lat: 14.74156, lng: -17.45131 },
  { id: "BRT_13", nom: "Grand Médine - PEM", lat: 14.74795, lng: -17.44715 },
  { id: "BRT_14", nom: "Police des Parcelles", lat: 14.7512, lng: -17.4395 },
  { id: "BRT_15", nom: "Croisement 22", lat: 14.75369, lng: -17.43181 },
  { id: "BRT_16", nom: "Parcelles Assainies", lat: 14.76269, lng: -17.42431 },
  { id: "BRT_17", nom: "Ndingala - Golf Sud", lat: 14.76462, lng: -17.41969 },
  { id: "BRT_18", nom: "Golf Sud", lat: 14.76756, lng: -17.41356 },
  { id: "BRT_19", nom: "Dalal Jam - Hôpital", lat: 14.77287, lng: -17.40979 },
  { id: "BRT_20", nom: "Fith Mith", lat: 14.77019, lng: -17.40156 },
  { id: "BRT_21", nom: "Golf Nord", lat: 14.77619, lng: -17.39881 },
  { id: "BRT_22", nom: "Gadaye - Cambérène", lat: 14.7745, lng: -17.393 },
  { id: "BRT_23", nom: "Préfecture Guédiawaye - PEM", lat: 14.77156, lng: -17.38694 },
];

export const STATIONS_TER = [
  { id: "TER_01", nom: "Gare de Dakar", lat: 14.67599, lng: -17.43352 },
  { id: "TER_02", nom: "Colobane", lat: 14.70035, lng: -17.44165 },
  { id: "TER_03", nom: "Hann", lat: 14.72209, lng: -17.43207 },
  { id: "TER_04", nom: "Dalifort", lat: 14.73425, lng: -17.419 },
  { id: "TER_05", nom: "Baux Maraîchers", lat: 14.73971, lng: -17.40361 },
  { id: "TER_06", nom: "Pikine", lat: 14.74986, lng: -17.39169 },
  { id: "TER_07", nom: "Thiaroye", lat: 14.75877, lng: -17.3803 },
  { id: "TER_08", nom: "Yeumbeul", lat: 14.76491, lng: -17.3565 },
  { id: "TER_09", nom: "Keur Mbaye Fall", lat: 14.74408, lng: -17.31389 },
  { id: "TER_10", nom: "PNR", lat: 14.72317, lng: -17.28394 },
  { id: "TER_11", nom: "Rufisque", lat: 14.71596, lng: -17.27 },
  { id: "TER_12", nom: "Bargny", lat: 14.69818, lng: -17.2292 },
  { id: "TER_13", nom: "Diamniadio", lat: 14.71606, lng: -17.19845 },
];
