import ScraperDashboard from '@/components/ScraperDashboard';
import Link from 'next/link';

export const metadata = {
  title: 'Administration - Agrégation & Scraping | Facilité',
  description: 'Panneau de gestion et déclenchement du scraping pour alimenter la base de données Supabase.',
};

export default function ScrapingAdminPage() {
  return (
    <main className="min-h-screen p-6 md:p-12 bg-[#FAF6F1] dark:bg-gray-950">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
          <div>
            <span className="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 font-semibold text-xs rounded-full uppercase tracking-wide mb-2">
              Module Admin
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">
              Tableau de Bord - Scraping & Données
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Connexion en temps réel avec le service FastAPI et la base PostgreSQL Supabase.
            </p>
          </div>
          <Link
            href="/admin"
            className="self-start sm:self-center px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            ← Retour Admin
          </Link>
        </div>

        <ScraperDashboard />
      </div>
    </main>
  );
}
