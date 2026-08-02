/**
 * Détecte le mode sandbox KPay (clé kpay_test_...) côté client, pour
 * afficher un bandeau d'avertissement tant que le compte marchand Live
 * n'est pas validé par KPay. NEXT_PUBLIC_KPAY_PUBLIC_KEY est figée au
 * build (comme côté serveur dans src/lib/kpay.js) : ce fichier n'a donc
 * rien à recharger au runtime, juste à être réimporté après un redeploy
 * une fois les clés Live activées pour que le bandeau disparaisse.
 */
export const KPAY_TEST_MODE = !(process.env.NEXT_PUBLIC_KPAY_PUBLIC_KEY || "").startsWith("kpay_live_");
