// Détection simple des tentatives d'injection de consignes dans un message d'aide.
// Le message de l'utilisateur est toujours traité comme une DONNÉE (jamais comme une consigne) ; ce
// filtre sert en plus à ne pas dépenser un appel d'IA sur une tentative évidente.

const MOTIFS = [
  /ignor(e|ez|er)\s+(toutes?\s+)?(les\s+|tes\s+|vos\s+)?(instructions?|consignes?|r[eè]gles?)/i,
  /(oublie|oubliez|effac(e|ez))\s+(toutes?\s+)?(les\s+|tes\s+|vos\s+)?(instructions?|consignes?|r[eè]gles?)/i,
  /ignore\s+(all\s+|previous\s+|the\s+)*(instructions?|rules?|prompts?)/i,
  /(r[ée]v[eè]le|affiche|montre|donne|dis)[\s\S]{0,30}(prompt|instructions?|consignes?)\s*(syst[eè]me|initial|cach[ée]|interne)?/i,
  /(system|syst[eè]me)\s*prompt/i,
  /prompt\s+syst[eè]me/i,
  /tu\s+es\s+maintenant/i,
  /(fais|agis|joue)\s+(comme|le r[oô]le)/i,
  /\bact\s+as\b/i,
  /jailbreak|\bDAN\b/i,
  /<\s*\/?\s*(system|assistant|instructions?)\s*>/i,
  /\[\s*(system|inst)\s*\]/i,
  /(donne|envoie|affiche)[\s\S]{0,40}(donn[ée]es|messages|cv|mot de passe|email)[\s\S]{0,30}(autres?\s+utilisateurs?|tous les utilisateurs|d'un autre)/i,
];

export function detecterInjection(texte) {
  const t = String(texte || "");
  return MOTIFS.some((m) => m.test(t));
}
