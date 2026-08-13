import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";

// Fonction utilitaire pour faire une pause (polling)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Cette fonction doit gérer l'obtention/rafraîchissement du token OAuth Canva
async function getCanvaAccessToken() {
  // TODO: Implémenter la logique d'échange du Refresh Token pour un Access Token valide.
  // L'API Canva requiert un token OAuth valide (idéalement au nom d'un compte Enterprise pour Autofill).
  // Pour un usage headless, vous devrez probablement utiliser un flux Client Credentials ou
  // stocker un Refresh Token valide généré manuellement et le rafraîchir ici.
  
  const clientId = process.env.CANVA_CLIENT_ID;
  const clientSecret = process.env.CANVA_CLIENT_SECRET;
  
  console.warn("RAPPEL: Vous devez implémenter la récupération du token OAuth Canva réel.");
  return "VOTRE_ACCESS_TOKEN_ACTUEL_A_REMPLACER";
}

export async function POST(req) {
  try {
    const { user, error: authError } = await requireUser(req, { logDenials: true });
    if (authError) return authError;

    const body = await req.json();
    const { templateId, data } = body;
    
    if (!templateId || !data) {
      return NextResponse.json({ success: false, error: "templateId et data sont requis." }, { status: 400 });
    }

    const token = await getCanvaAccessToken();

    // 1. DÉMARRER LE JOB AUTOFILL
    const autofillRes = await fetch("https://api.canva.com/rest/v1/autofills", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        type: "create_from_brand_template",
        brand_template_id: templateId,
        data: data // Mappe directement les clés (firstName, etc.) avec les champs du modèle Canva
      })
    });
    
    const autofillData = await autofillRes.json();
    if (!autofillRes.ok) {
      console.error("Erreur Canva Autofill:", autofillData);
      throw new Error(autofillData.message || "Erreur lors du démarrage du job Autofill");
    }
    
    let autofillJobId = autofillData.job.id;
    let designId = null;

    // 2. POLLING DU JOB AUTOFILL
    let attempts = 0;
    while (attempts < 10) {
      await sleep(2000); // attendre 2 secondes
      const checkRes = await fetch(`https://api.canva.com/rest/v1/autofills/${autofillJobId}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const checkData = await checkRes.json();
      
      if (checkData.job.status === "success") {
        designId = checkData.job.result.design.id;
        break;
      }
      if (checkData.job.status === "failed") {
        throw new Error("Le job Autofill a échoué chez Canva.");
      }
      attempts++;
    }

    if (!designId) {
      throw new Error("Timeout: Le design n'a pas pu être généré après 20 secondes.");
    }

    // 3. DÉMARRER L'EXPORT PDF
    const exportRes = await fetch("https://api.canva.com/rest/v1/exports", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        design_id: designId,
        format: { type: "pdf", export_quality: "regular" }
      })
    });
    
    const exportData = await exportRes.json();
    if (!exportRes.ok) {
      console.error("Erreur Canva Export:", exportData);
      throw new Error(exportData.message || "Erreur lors du démarrage de l'export PDF");
    }

    let exportJobId = exportData.job.id;
    let pdfUrl = null;

    // 4. POLLING DU JOB EXPORT
    attempts = 0;
    while (attempts < 15) {
      await sleep(2000); // attendre 2 secondes
      const checkExportRes = await fetch(`https://api.canva.com/rest/v1/exports/${exportJobId}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const checkExportData = await checkExportRes.json();
      
      if (checkExportData.job.status === "success") {
        pdfUrl = checkExportData.job.urls[0]; // URL de téléchargement finale du PDF
        break;
      }
      if (checkExportData.job.status === "failed") {
        throw new Error("Le job d'export a échoué chez Canva.");
      }
      attempts++;
    }

    if (!pdfUrl) {
      throw new Error("Timeout: L'export du PDF a échoué après 30 secondes.");
    }

    // 5. RENVOYER LE RÉSULTAT AU FRONTEND
    return NextResponse.json({ success: true, downloadUrl: pdfUrl });

  } catch (error) {
    console.error("API Generate CV Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
