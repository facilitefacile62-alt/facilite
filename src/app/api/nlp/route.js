import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req) {
  try {
    const { texteBrut, instructionSysteme } = await req.json();

    // 1. Sécurité : Vérification de la présence des données requises
    if (!texteBrut || !instructionSysteme) {
      return NextResponse.json(
        { success: false, message: "Les paramètres 'texteBrut' et 'instructionSysteme' sont requis." },
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

    // 2. Connexion sécurisée au modèle
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // 3. Configuration spécifique NLP : On exige du JSON pur
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json", 
      }
    }); 

    // 4. Assemblage de l'ordre strict et du texte à traiter
    const prompt = `${instructionSysteme}\n\nTexte à analyser :\n${texteBrut}`;

    // 5. Génération et conversion
    const result = await model.generateContent(prompt);
    
    // Le NLP renvoie une chaîne au format JSON que l'on transforme en véritable objet JS
    const donneesStructurees = JSON.parse(result.response.text());

    // 6. Envoi des données prêtes à l'emploi au Front-end
    return NextResponse.json({ success: true, data: donneesStructurees });

  } catch (error) {
    console.error("Erreur du moteur NLP :", error);
    return NextResponse.json(
      { success: false, message: "Échec de l'analyse sémantique." }, 
      { status: 500 }
    );
  }
}
