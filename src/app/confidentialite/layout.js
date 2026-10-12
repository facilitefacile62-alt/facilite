// Page en double (Search Console, « Page en double sans URL canonique
// sélectionnée par l'utilisateur ») : /confidentialite et /politique-de-confidentialite affichent le même contenu.
// On déclare explicitement laquelle fait foi.
export const metadata = {
  alternates: { canonical: "/politique-de-confidentialite" },
};

export default function Layout({ children }) {
  return children;
}
