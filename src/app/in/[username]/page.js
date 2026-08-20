import { getSupabasePublicClient, getSignedAvatarUrl } from "@/lib/supabase";
import PublicProfileClient from "./PublicProfileClient";

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL && process.env.NEXT_PUBLIC_APP_URL.startsWith('http')) ? process.env.NEXT_PUBLIC_APP_URL : "https://ffacilite.com";

// Wrapper serveur pur (option B, validée) : PublicProfileClient reste
// intégralement inchangé et continue de faire son propre fetch — ce
// fichier ne fait qu'un second fetch minimal, séparé, pour generateMetadata
// uniquement. Coût : une requête RPC de plus au chargement, contre zéro
// risque de casser l'interactivité existante (composant client non touché).
async function fetchProfileForMetadata(username) {
  try {
    const decoded = decodeURIComponent(username).toLowerCase();
    const supabase = getSupabasePublicClient();

    // Même stratégie de résolution à 3 niveaux que PublicProfileClient
    // (slug -> id -> nom partiel), pour que le titre/description reflètent
    // bien le profil réellement affiché plutôt qu'une correspondance
    // différente.
    let { data } = await supabase.rpc("get_profils_publics").select("*").eq("slug", decoded).maybeSingle();

    if (!data) {
      const { data: idData } = await supabase.rpc("get_profils_publics").select("*").eq("id", decoded).maybeSingle();
      data = idData;
    }

    if (!data) {
      const { data: nameData } = await supabase
        .rpc("get_profils_publics")
        .select("*")
        .ilike("full_name", `%${decoded}%`)
        .limit(1);
      if (nameData && nameData.length > 0) data = nameData[0];
    }

    return data || null;
  } catch (err) {
    console.error("[in/[username] generateMetadata] Échec du chargement du profil :", err.message);
    return null;
  }
}

export async function generateMetadata({ params }) {
  const { username } = await params;
  const profile = await fetchProfileForMetadata(username);

  if (!profile) {
    return { title: "Profil introuvable" };
  }

  const fullName = profile.full_name || "Membre Facilité";
  const headline = profile.headline || "Professionnel sur Facilité";
  const cleanBio = (profile.bio || "").replace(/\s+/g, " ").trim();
  const description = cleanBio.slice(0, 160) || `Découvrez le profil de ${fullName} (${headline}) sur Facilité.`;
  const url = `${SITE_URL}/in/${username}`;
  const signedAvatar = await getSignedAvatarUrl(profile.avatar_url).catch(() => null);
  const imageUrl = signedAvatar || `${SITE_URL}/logo.jpeg`;

  return {
    // Pas de "| Facilité" ici : le template du layout racine
    // (title.template: "%s | Facilite") l'ajoute déjà automatiquement.
    title: `${fullName} — ${headline}`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${fullName} — ${headline}`,
      description,
      url,
      type: "profile",
      locale: "fr_SN",
      siteName: "Facilité",
      images: [{ url: imageUrl, width: 400, height: 400, alt: fullName }],
    },
    twitter: {
      card: "summary",
      title: `${fullName} — ${headline}`,
      description,
      images: [imageUrl],
    },
  };
}

export default function Page() {
  return <PublicProfileClient />;
}
