// Page en double (Search Console, « Page en double sans URL canonique
// sélectionnée par l'utilisateur ») : /conditions et /conditions-utilisation affichent le même contenu.
// On déclare explicitement laquelle fait foi.
export const metadata = {
  alternates: { canonical: "/conditions" },
};

export default function Layout({ children }) {
  return children;
}
