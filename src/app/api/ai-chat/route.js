import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const body = await req.json();
    const { message, activeAiRole } = body;

    if (!message) {
      return NextResponse.json({ error: "Le message est requis." }, { status: 400 });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      console.error("Clé DEEPSEEK_API_KEY manquante dans .env");
      return NextResponse.json(
        { error: "Configuration serveur incomplète (Clé API DeepSeek manquante)." },
        { status: 500 }
      );
    }

    // Adaptateur de rôle selon le choix de l'utilisateur
    let systemPrompt = `Tu es l'assistant IA officiel de la plateforme Facilite (facilitefacile.com). 
Ton rôle est d'aider les utilisateurs professionnels et candidats au Sénégal. 
Sois clair, dynamique, courtois et structuré dans tes réponses.`;

    if (activeAiRole === 'cv') {
      systemPrompt += " Spécialisation : Rédaction, correction et mise en valeur de CV et lettres de motivation.";
    } else if (activeAiRole === 'coach' || activeAiRole === 'interview') {
      systemPrompt += " Spécialisation : Coaching pour entretiens d'embauche et conseils pour convaincre les recruteurs.";
    } else if (activeAiRole === 'orientation') {
      systemPrompt += " Spécialisation : Orientation académique, démarches administratives et conseils de carrière.";
    }

    // Appel direct à l'API DeepSeek
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ],
        temperature: 0.7,
        stream: false
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Erreur réponse DeepSeek:", errorData);
      return NextResponse.json(
        { error: `Erreur API DeepSeek (${response.status})` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "Désolé, je n'ai pas pu générer de réponse.";

    return NextResponse.json({ reply });

  } catch (error) {
    console.error("Erreur serveur lors de l'appel DeepSeek:", error);
    return NextResponse.json(
      { error: "Erreur serveur interne lors du traitement de votre demande." },
      { status: 500 }
    );
  }
}
