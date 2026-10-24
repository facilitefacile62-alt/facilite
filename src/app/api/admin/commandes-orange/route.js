import { NextResponse } from "next/server";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isCallerAdmin } from "@/lib/rbac";
import { MONTANT_FORMATION_CV_XOF } from "@/lib/formationCvPaiement";
import { STATUT_PAIEMENT_EN_DOUBLE } from "@/lib/webhookOrange";

export const runtime = "nodejs";

const LOT_MAX = 100;

/**
 * Suivi ADMIN des commandes Orange Money : achats de jetons et inscriptions à la formation CV en attente de paiement (« pending » / non
 * payées) ou échouées. Lecture seule : aucun crédit ici (voir ./reverifier pour relancer la vérification auprès d'Orange). Les empreintes
 * de jetons de callback ne sont jamais renvoyées.
 */
export async function GET(req) {
  try {
    const { user, error: authError } = await requireUser(req);
    if (authError) return authError;

    const { allowed, error: rateError } = await checkRateLimit(user.id);
    if (!allowed) return rateError;

    const admin = getSupabaseAdmin();
    if (!(await isCallerAdmin(admin, user.id))) {
      return NextResponse.json({ error: "Réservé aux administrateurs." }, { status: 403 });
    }

    const [achats, formations, achatsCv] = await Promise.all([
      admin
        .from("jetons_transactions")
        .select("id, store_id, montant, montant_xof, status, provider_reference, created_at")
        .eq("type", "achat")
        .in("status", ["pending", "failed"])
        .order("created_at", { ascending: false })
        .limit(LOT_MAX),
      admin
        .from("formation_redaction_cv_inscriptions")
        .select("id, user_id, paye, orange_transaction_id, created_at, updated_at")
        .eq("paye", false)
        .not("callback_token_hash", "is", null)
        .order("updated_at", { ascending: false })
        .limit(LOT_MAX),
      // Achats de modèles de CV non aboutis : en attente, ou « failed » avec un QR créé (un paiement tardif peut encore arriver).
      admin
        .from("cv_achats")
        .select("id, user_id, modele_id, montant_xof, status, provider_reference, created_at")
        .in("status", ["pending", "failed"])
        .not("provider_reference", "is", null)
        .order("created_at", { ascending: false })
        .limit(LOT_MAX),
    ]);
    // Paiements EN DOUBLE (même QR payé deux fois) : événements SUCCESS confirmés par Orange pour une commande déjà créditée par une autre
    // transaction (statut DOUBLE_PAIEMENT, voir webhookOrange). À rembourser ; la commande, elle, n'a été créditée qu'une fois.
    const [doublesJetons, doublesFormation, doublesCv] = await Promise.all([
      admin.from("jetons_webhook_events").select("id, reference, orange_transaction_id, jetons_transaction_id, received_at").eq("status", STATUT_PAIEMENT_EN_DOUBLE).order("received_at", { ascending: false }).limit(LOT_MAX),
      admin.from("formation_redaction_cv_webhook_events").select("id, reference, orange_transaction_id, inscription_id, received_at").eq("status", STATUT_PAIEMENT_EN_DOUBLE).order("received_at", { ascending: false }).limit(LOT_MAX),
      admin.from("cv_achat_webhook_events").select("id, reference, orange_transaction_id, achat_id, received_at").eq("status", STATUT_PAIEMENT_EN_DOUBLE).order("received_at", { ascending: false }).limit(LOT_MAX),
    ]);
    if (doublesJetons.error || doublesFormation.error || doublesCv.error) {
      console.error("[Admin Commandes Orange] Lecture des doubles impossible :", doublesJetons.error?.message || doublesFormation.error?.message || doublesCv.error?.message);
      return NextResponse.json({ error: "Lecture impossible." }, { status: 500 });
    }
    const idsJetons = [...new Set(doublesJetons.data.map((e) => e.jetons_transaction_id).filter(Boolean))];
    const idsFormation = [...new Set(doublesFormation.data.map((e) => e.inscription_id).filter(Boolean))];
    const idsCv = [...new Set(doublesCv.data.map((e) => e.achat_id).filter(Boolean))];
    const [commandesDoubles, inscriptionsDoubles, achatsDoubles] = await Promise.all([
      idsJetons.length ? admin.from("jetons_transactions").select("id, montant_xof, provider_reference").in("id", idsJetons) : { data: [], error: null },
      idsFormation.length ? admin.from("formation_redaction_cv_inscriptions").select("id, orange_transaction_id").in("id", idsFormation) : { data: [], error: null },
      idsCv.length ? admin.from("cv_achats").select("id, user_id, modele_id, montant_xof").in("id", idsCv) : { data: [], error: null },
    ]);
    const parId = (liste) => Object.fromEntries((liste.data ?? []).map((l) => [l.id, l]));
    const jetonsParId = parId(commandesDoubles);
    const formationParId = parId(inscriptionsDoubles);
    const cvParId = parId(achatsDoubles);
    // Transaction Orange qui a validé le modèle (achat « success » du même compte et du même modèle) : c'est l'AUTRE qui est à rembourser.
    const succesCv = idsCv.length
      ? await admin.from("cv_achats").select("user_id, modele_id, provider_reference").eq("status", "success").in("user_id", [...new Set(achatsDoubles.data.map((a) => a.user_id))])
      : { data: [] };
    const transactionValideeCv = (achat) => succesCv.data?.find((s) => s.user_id === achat?.user_id && s.modele_id === achat?.modele_id)?.provider_reference ?? null;

    if (achats.error || formations.error || achatsCv.error) {
      console.error("[Admin Commandes Orange] Lecture impossible :", achats.error?.message || formations.error?.message || achatsCv.error?.message);
      return NextResponse.json({ error: "Lecture impossible." }, { status: 500 });
    }

    return NextResponse.json({
      doubles: [
        ...doublesJetons.data.map((e) => ({
          type: "jetons",
          evenementId: e.id,
          reference: e.reference,
          transactionEnDouble: e.orange_transaction_id,
          transactionCreditee: jetonsParId[e.jetons_transaction_id]?.provider_reference ?? null,
          montantXof: jetonsParId[e.jetons_transaction_id]?.montant_xof ?? null,
          recuLe: e.received_at,
        })),
        ...doublesFormation.data.map((e) => ({
          type: "formation",
          evenementId: e.id,
          reference: e.reference,
          transactionEnDouble: e.orange_transaction_id,
          transactionCreditee: formationParId[e.inscription_id]?.orange_transaction_id ?? null,
          montantXof: MONTANT_FORMATION_CV_XOF,
          recuLe: e.received_at,
        })),
        ...doublesCv.data.map((e) => ({
          type: "cv",
          evenementId: e.id,
          reference: e.reference,
          transactionEnDouble: e.orange_transaction_id,
          transactionCreditee: transactionValideeCv(cvParId[e.achat_id]),
          montantXof: cvParId[e.achat_id]?.montant_xof ?? null,
          recuLe: e.received_at,
        })),
      ].sort((a, b) => String(b.recuLe).localeCompare(String(a.recuLe))),
      jetons: achats.data.map((c) => ({
        id: c.id,
        etat: c.status,
        montantXof: c.montant_xof ?? null,
        jetons: c.montant,
        transactionOrange: c.provider_reference ?? null,
        creeLe: c.created_at,
        magasin: c.store_id,
      })),
      achatsCv: achatsCv.data.map((c) => ({
        id: c.id,
        etat: c.status,
        montantXof: c.montant_xof ?? null,
        transactionOrange: c.provider_reference ?? null,
        creeLe: c.created_at,
        utilisateur: c.user_id,
        modele: c.modele_id,
      })),
      formations: formations.data.map((c) => ({
        id: c.id,
        etat: "pending",
        montantXof: MONTANT_FORMATION_CV_XOF,
        transactionOrange: c.orange_transaction_id ?? null,
        creeLe: c.updated_at || c.created_at,
        utilisateur: c.user_id,
      })),
    });
  } catch (err) {
    console.error("[Admin Commandes Orange Error]", err);
    return NextResponse.json({ error: "Une erreur interne est survenue." }, { status: 500 });
  }
}
