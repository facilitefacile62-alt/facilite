import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req) {
  try {
    const { message } = await req.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: "Message invalide" }, { status: 400 });
    }

    // Dictionnaire et consigne stricte (anti-hallucination)
    const SYSTEM_PROMPT = `
Tu es l'assistant vocal officiel de Facilité (ffacilite.com).
Réponds de façon concise, naturelle et directe (1 phrase courte adaptée à la lecture vocale).

BASE DE CONNAISSANCES STRICTE :
- Aller à Pikine : "Pour aller à Pikine, prenez le bus 26 ou un taxi."
- Aller à Guédiawaye : "Pour Guédiawaye, empruntez le bus 28 ou un taxi direct."
- Déposer un CV : "Déposez votre CV directement dans l'onglet Candidat sur le site ffacilite.com."
- Créer une offre : "Connectez-vous sur votre espace recruteur pour publier votre annonce."

RÈGLE ABSOLUE : Si la question ne figure pas dans la liste ci-dessus, réponds exactement : "Je n'ai pas cette information pour le moment, veuillez contacter notre support." Ne rajoute aucune autre phrase.
`;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Clé API Gemini non configurée" }, { status: 500 });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: `${SYSTEM_PROMPT}\n\nQuestion de l'utilisateur : "${message}"` }]
            }
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 60
          }
        })
      }
    );

    const data = await response.json();
    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "Désolé, je n'ai pas compris votre demande.";

    return NextResponse.json({ reply: replyText });
  } catch (error) {
    console.error("voice-assistant error:", error);
    return NextResponse.json({ error: "Erreur de traitement vocal" }, { status: 500 });
  }
}
