"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import AdminMarketplaceStores from "@/components/AdminMarketplaceStores";

export default function AdminBoutiquesPage() {
  const { isAdmin, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-gray-400">
        <i className="fa-solid fa-spinner fa-spin text-2xl text-emerald-600"></i>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center">
          <i className="fa-solid fa-lock text-3xl text-gray-300"></i>
          <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mt-4">
            Réservé aux administrateurs
          </p>
          <Link
            href="/"
            className="mt-5 inline-block px-6 py-3 rounded-2xl bg-gray-900 text-white font-bold text-sm"
          >
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF6F1]/50 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
          <Link href="/admin" className="hover:text-gray-900 transition flex items-center gap-1">
            <i className="fa-solid fa-arrow-left text-[10px]"></i>
            <span>Retour au tableau de bord Admin</span>
          </Link>
          <span>/</span>
          <span className="text-gray-900">Boutiques Marketplace</span>
        </div>

        <AdminMarketplaceStores />
      </div>
    </div>
  );
}
