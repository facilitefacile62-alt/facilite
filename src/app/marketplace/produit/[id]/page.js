import { redirect } from "next/navigation";

export default async function ProduitPage({ params }) {
  const resolvedParams = await params;
  const id = resolvedParams?.id;
  if (id) {
    redirect(`/marketplace?article=${encodeURIComponent(id)}`);
  }
  redirect("/marketplace");
}
