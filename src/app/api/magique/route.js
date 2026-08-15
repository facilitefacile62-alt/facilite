import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req) {
  try {
    const { texteInitial } = await req.json();

    if (!texteInitial || typeof texteInitial !== 'string' || !texteInitial.trim()) {
      return NextResponse.json(
        { success: false, message: "Le texte initial est vide ou invalide." },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, message: "Clé GEMINI_API_KEY non configurée." },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); 

    const prompt = `Agis comme un expert en ressources humaines et recrutement de haut niveau. 
Reformule et améliore ce texte pour un CV professionnel. Le texte doit être percutant, valorisant, utiliser des verbes d'action, et corriger les fautes éventuelles.
Ne rajoute pas de fausses informations. Garde-le concis et prêt à l'emploi.
Voici le texte à améliorer : "${texteInitial}"`;

    const result = await model.generateContent(prompt);
    const texteAmeliore = result.response.text();

    return NextResponse.json({ success: true, texteAmeliore: texteAmeliore.trim() });

  } catch (error) {
    console.error("Erreur de l'Écriture Magique :", error);
    return NextResponse.json(
      { success: false, message: "Impossible de joindre l'IA pour le moment." }, 
      { status: 500 }
    );
  }
}
