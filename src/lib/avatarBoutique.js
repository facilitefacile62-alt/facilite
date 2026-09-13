// Avatars de boutique façon Bitmoji, générés en local par DiceBear
// (@dicebear/core + @dicebear/collection, style "avataaars") — du SVG
// synthétisé côté client, aucun appel réseau, aucune clé API. `avatar_config`
// ne stocke QUE les paramètres choisis (JSON), jamais une image rendue : on
// peut donc régénérer/modifier l'avatar à tout moment.
//
// randomizeIds: true est indispensable dès qu'on inline plusieurs de ces SVG
// dans le même document (plusieurs pins sur une carte, aperçu + vignettes...)
// — sans ça, chaque avatar réutilise le même id statique "viewboxMask" pour
// son masque interne, et le navigateur ne retient que la PREMIÈRE définition
// pour toutes les instances suivantes, corrompant visuellement les avatars
// au-delà du premier. Confirmé en inspectant la sortie brute de
// createAvatar(...).toString() : sans randomizeIds, deux avatars différents
// produisent tous deux id="viewboxMask".
import { createAvatar } from "@dicebear/core";
import { avataaars } from "@dicebear/collection";

export const OPTIONS_SKIN_COLOR = [
  { valeur: "614335", label: "Peau très foncée" },
  { valeur: "d08b5b", label: "Peau foncée" },
  { valeur: "ae5d29", label: "Peau brune" },
  { valeur: "edb98a", label: "Peau dorée" },
  { valeur: "ffdbb4", label: "Peau claire" },
  { valeur: "fd9841", label: "Peau hâlée" },
  { valeur: "f8d25c", label: "Peau très claire" },
];

export const OPTIONS_HAIR_COLOR = [
  { valeur: "a55728", label: "Auburn" },
  { valeur: "2c1b18", label: "Noir" },
  { valeur: "b58143", label: "Châtain clair" },
  { valeur: "d6b370", label: "Blond foncé" },
  { valeur: "724133", label: "Châtain" },
  { valeur: "4a312c", label: "Brun foncé" },
  { valeur: "f59797", label: "Rose" },
  { valeur: "ecdcbf", label: "Blond platine" },
  { valeur: "c93305", label: "Roux" },
  { valeur: "e8e1e1", label: "Gris argenté" },
];

export const OPTIONS_BACKGROUND_COLOR = [
  { valeur: "b6e3f4", label: "Bleu pastel" },
  { valeur: "c0aede", label: "Violet pastel" },
  { valeur: "d1d4f9", label: "Lavande" },
  { valeur: "ffd5dc", label: "Rose pastel" },
  { valeur: "ffdfbf", label: "Pêche" },
  { valeur: "c9f2c7", label: "Vert menthe" },
  { valeur: "fff5ba", label: "Jaune pastel" },
  { valeur: "a0e7e5", label: "Turquoise" },
];

export const OPTIONS_TOP = [
  { valeur: "shortFlat", label: "Courts plats" },
  { valeur: "shortRound", label: "Courts arrondis" },
  { valeur: "shortWaved", label: "Courts ondulés" },
  { valeur: "shortCurly", label: "Courts bouclés" },
  { valeur: "shaggy", label: "Effilés" },
  { valeur: "shaggyMullet", label: "Mulet effilé" },
  { valeur: "theCaesar", label: "Coupe César" },
  { valeur: "theCaesarAndSidePart", label: "César + raie" },
  { valeur: "sides", label: "Sur les côtés" },
  { valeur: "shavedSides", label: "Rasé sur les côtés" },
  { valeur: "curly", label: "Bouclés" },
  { valeur: "curvy", label: "Ondulés longs" },
  { valeur: "straight01", label: "Raides longs 1" },
  { valeur: "straight02", label: "Raides longs 2" },
  { valeur: "straightAndStrand", label: "Raides + mèche" },
  { valeur: "frizzle", label: "Frisottés" },
  { valeur: "bob", label: "Carré plongeant" },
  { valeur: "bun", label: "Chignon" },
  { valeur: "longButNotTooLong", label: "Mi-longs" },
  { valeur: "miaWallace", label: "Carré frange" },
  { valeur: "bigHair", label: "Volumineux" },
  { valeur: "fro", label: "Afro" },
  { valeur: "froBand", label: "Afro + bandeau" },
  { valeur: "dreads01", label: "Dreadlocks 1" },
  { valeur: "dreads02", label: "Dreadlocks 2" },
  { valeur: "frida", label: "Bandeau fleuri" },
  { valeur: "hat", label: "Casquette" },
  { valeur: "hijab", label: "Hijab" },
  { valeur: "turban", label: "Turban" },
  { valeur: "winterHat1", label: "Bonnet 1" },
  { valeur: "winterHat02", label: "Bonnet 2" },
  { valeur: "winterHat03", label: "Bonnet 3" },
  { valeur: "winterHat04", label: "Bonnet 4" },
];

export const OPTIONS_TOP_FEMME = [
  { valeur: "curvy", label: "Ondulés longs" },
  { valeur: "straight01", label: "Raides longs 1" },
  { valeur: "straight02", label: "Raides longs 2" },
  { valeur: "straightAndStrand", label: "Raides + mèche" },
  { valeur: "bob", label: "Carré plongeant" },
  { valeur: "bun", label: "Chignon" },
  { valeur: "longButNotTooLong", label: "Mi-longs" },
  { valeur: "miaWallace", label: "Carré frange" },
  { valeur: "bigHair", label: "Volumineux" },
  { valeur: "fro", label: "Afro" },
  { valeur: "froBand", label: "Afro + bandeau" },
  { valeur: "frida", label: "Bandeau fleuri" },
  { valeur: "curly", label: "Bouclés" },
  { valeur: "frizzle", label: "Frisottés" },
  { valeur: "dreads01", label: "Dreadlocks 1" },
  { valeur: "dreads02", label: "Dreadlocks 2" },
  { valeur: "hijab", label: "Hijab" },
  { valeur: "turban", label: "Turban" },
  { valeur: "hat", label: "Casquette" },
  { valeur: "winterHat1", label: "Bonnet 1" },
  { valeur: "winterHat02", label: "Bonnet 2" },
];

export const OPTIONS_TOP_HOMME = [
  { valeur: "shortFlat", label: "Courts plats" },
  { valeur: "shortRound", label: "Courts arrondis" },
  { valeur: "shortWaved", label: "Courts ondulés" },
  { valeur: "shortCurly", label: "Courts bouclés" },
  { valeur: "shaggy", label: "Effilés" },
  { valeur: "shaggyMullet", label: "Mulet effilé" },
  { valeur: "theCaesar", label: "Coupe César" },
  { valeur: "theCaesarAndSidePart", label: "César + raie" },
  { valeur: "sides", label: "Sur les côtés" },
  { valeur: "shavedSides", label: "Rasé sur les côtés" },
  { valeur: "fro", label: "Afro" },
  { valeur: "froBand", label: "Afro + bandeau" },
  { valeur: "dreads01", label: "Dreadlocks 1" },
  { valeur: "dreads02", label: "Dreadlocks 2" },
  { valeur: "turban", label: "Turban" },
  { valeur: "hat", label: "Casquette" },
  { valeur: "winterHat1", label: "Bonnet 1" },
  { valeur: "winterHat02", label: "Bonnet 2" },
  { valeur: "winterHat03", label: "Bonnet 3" },
  { valeur: "winterHat04", label: "Bonnet 4" },
];

export const OPTIONS_EYEBROWS = [
  { valeur: "default", label: "Classiques" },
  { valeur: "defaultNatural", label: "Naturels" },
  { valeur: "flatNatural", label: "Plats naturels" },
  { valeur: "raisedExcited", label: "Surpris" },
  { valeur: "raisedExcitedNatural", label: "Surpris naturels" },
  { valeur: "sadConcerned", label: "Inquiets" },
  { valeur: "sadConcernedNatural", label: "Inquiets naturels" },
  { valeur: "angry", label: "Froncés" },
  { valeur: "angryNatural", label: "Froncés naturels" },
  { valeur: "unibrowNatural", label: "Monosourcil" },
  { valeur: "upDown", label: "Asymétriques" },
  { valeur: "upDownNatural", label: "Asymétriques naturels" },
  { valeur: "frownNatural", label: "Contrariés naturels" },
];

export const OPTIONS_EYES = [
  { valeur: "default", label: "Classiques" },
  { valeur: "happy", label: "Joyeux" },
  { valeur: "wink", label: "Clin d'œil" },
  { valeur: "winkWacky", label: "Clin d'œil farceur" },
  { valeur: "side", label: "De côté" },
  { valeur: "squint", label: "Plissés" },
  { valeur: "surprised", label: "Surpris" },
  { valeur: "hearts", label: "Cœurs" },
  { valeur: "closed", label: "Fermés" },
  { valeur: "cry", label: "Larmoyants" },
  { valeur: "eyeRoll", label: "Yeux au ciel" },
  { valeur: "xDizzy", label: "Étourdis" },
];

export const OPTIONS_MOUTH = [
  { valeur: "default", label: "Classique" },
  { valeur: "smile", label: "Sourire" },
  { valeur: "twinkle", label: "Malicieuse" },
  { valeur: "serious", label: "Sérieuse" },
  { valeur: "concerned", label: "Inquiète" },
  { valeur: "sad", label: "Triste" },
  { valeur: "disbelief", label: "Incrédule" },
  { valeur: "grimace", label: "Grimace" },
  { valeur: "eating", label: "En train de manger" },
  { valeur: "tongue", label: "Langue tirée" },
  { valeur: "screamOpen", label: "Cri" },
  { valeur: "vomit", label: "Nauséeuse" },
];

export const OPTIONS_CLOTHING = [
  { valeur: "shirtCrewNeck", label: "T-shirt col rond" },
  { valeur: "shirtVNeck", label: "T-shirt col V" },
  { valeur: "shirtScoopNeck", label: "T-shirt col échancré" },
  { valeur: "hoodie", label: "Sweat à capuche" },
  { valeur: "graphicShirt", label: "T-shirt imprimé" },
  { valeur: "collarAndSweater", label: "Col + pull" },
  { valeur: "blazerAndShirt", label: "Blazer + chemise" },
  { valeur: "blazerAndSweater", label: "Blazer + pull" },
  { valeur: "overall", label: "Salopette" },
];

// "Aucun(e)" en premier : c'est l'état "cette option ne s'affiche pas" —
// géré via *Probability à 0, pas en retirant l'option de la liste.
export const OPTIONS_FACIAL_HAIR = [
  { valeur: null, label: "Aucune" },
  { valeur: "beardLight", label: "Barbe légère" },
  { valeur: "beardMedium", label: "Barbe moyenne" },
  { valeur: "beardMajestic", label: "Barbe majestueuse" },
  { valeur: "moustacheFancy", label: "Moustache stylée" },
  { valeur: "moustacheMagnum", label: "Moustache Magnum" },
];

export const OPTIONS_ACCESSORIES = [
  { valeur: null, label: "Aucun" },
  { valeur: "round", label: "Lunettes rondes" },
  { valeur: "kurt", label: "Lunettes rondes fines" },
  { valeur: "prescription01", label: "Lunettes de vue 1" },
  { valeur: "prescription02", label: "Lunettes de vue 2" },
  { valeur: "wayfarers", label: "Lunettes Wayfarer" },
  { valeur: "sunglasses", label: "Lunettes de soleil" },
  { valeur: "eyepatch", label: "Cache-œil" },
];

/** Configuration de départ neutre selon le genre (garcon / femme) */
export function configAvatarParDefaut(genre = "femme") {
  const estFemme = genre === "femme";
  return {
    genre: estFemme ? "femme" : "garcon",
    skinColor: OPTIONS_SKIN_COLOR[3].valeur,
    top: estFemme ? OPTIONS_TOP_FEMME[0].valeur : OPTIONS_TOP_HOMME[0].valeur,
    hairColor: OPTIONS_HAIR_COLOR[1].valeur,
    facialHair: null,
    eyebrows: OPTIONS_EYEBROWS[0].valeur,
    eyes: OPTIONS_EYES[0].valeur,
    mouth: OPTIONS_MOUTH[1].valeur,
    clothing: estFemme ? "shirtScoopNeck" : "shirtCrewNeck",
    accessories: null,
    backgroundColor: OPTIONS_BACKGROUND_COLOR[0].valeur,
  };
}

const auHasard = (liste) => liste[Math.floor(Math.random() * liste.length)].valeur;

/** Tire une combinaison au hasard, adaptée au genre spécifié */
export function configAvatarAleatoire(genre = "femme") {
  const estFemme = genre === "femme";
  const listeCheveux = estFemme ? OPTIONS_TOP_FEMME : OPTIONS_TOP_HOMME;
  return {
    genre: estFemme ? "femme" : "garcon",
    skinColor: auHasard(OPTIONS_SKIN_COLOR),
    top: auHasard(listeCheveux),
    hairColor: auHasard(OPTIONS_HAIR_COLOR),
    facialHair: estFemme ? null : auHasard(OPTIONS_FACIAL_HAIR),
    eyebrows: auHasard(OPTIONS_EYEBROWS),
    eyes: auHasard(OPTIONS_EYES),
    mouth: auHasard(OPTIONS_MOUTH),
    clothing: auHasard(OPTIONS_CLOTHING),
    accessories: auHasard(OPTIONS_ACCESSORIES),
    backgroundColor: auHasard(OPTIONS_BACKGROUND_COLOR),
  };
}

/**
 * Traduit notre config (une valeur par axe) vers les options DiceBear
 * (des tableaux). La barbe/moustache et les accessoires sont pilotés par
 * *Probability (0 ou 100) plutôt que par la présence/absence dans le
 * tableau : ça évite à DiceBear de piocher une valeur au hasard quand
 * l'utilisateur a choisi "Aucune".
 */
function optionsDiceBearDepuisConfig(config, taille) {
  const c = { ...configAvatarParDefaut(), ...config };
  return {
    randomizeIds: true,
    size: taille,
    skinColor: [c.skinColor],
    top: [c.top],
    topProbability: 100,
    hairColor: [c.hairColor],
    facialHair: [c.facialHair || "beardLight"],
    facialHairColor: [c.hairColor],
    facialHairProbability: c.facialHair ? 100 : 0,
    eyebrows: [c.eyebrows],
    eyes: [c.eyes],
    mouth: [c.mouth],
    clothing: [c.clothing],
    clothesColor: ["3c4f5c"],
    accessories: [c.accessories || "round"],
    accessoriesProbability: c.accessories ? 100 : 0,
    backgroundColor: [c.backgroundColor],
  };
}

/** SVG brut (chaîne), à inliner directement — jamais d'URL externe. */
export function svgAvatarBoutique(config, taille = 96) {
  return createAvatar(avataaars, optionsDiceBearDepuisConfig(config, taille)).toString();
}

/** Data URI, pratique pour un <img src=...> React classique. */
export function dataUriAvatarBoutique(config, taille = 96) {
  return createAvatar(avataaars, optionsDiceBearDepuisConfig(config, taille)).toDataUri();
}

/**
 * Redimensionne les icônes avatar d'une carte Leaflet selon le zoom — plus
 * grand en zoomant, plus petit en dézoomant, borné pour rester lisible aux
 * niveaux extrêmes. Cible seulement les éléments portant la classe
 * .avatar-boutique-zoom-scale (voir globals.css) : jamais l'élément que
 * Leaflet positionne lui-même via son propre `transform` (translate3d),
 * sous peine de casser le placement du marqueur sur la carte.
 *
 * Retourne une fonction de nettoyage (détache l'écouteur) — facultative à
 * appeler puisque carte.remove() détache déjà tous les écouteurs de la
 * carte, mais utile si on veut la débrancher sans détruire la carte.
 */
export function brancherEchelleZoomAvatars(carte, { zoomReference = 14, pas = 0.08, min = 0.7, max = 1.4 } = {}) {
  const appliquer = () => {
    const zoom = carte.getZoom();
    const echelle = Math.min(max, Math.max(min, 1 + (zoom - zoomReference) * pas));
    carte.getContainer().querySelectorAll(".avatar-boutique-zoom-scale").forEach((el) => {
      el.style.transform = `scale(${echelle})`;
    });
  };
  carte.on("zoomend", appliquer);
  appliquer();
  return () => carte.off("zoomend", appliquer);
}
