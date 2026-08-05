'use client';

import { useState } from 'react';

export default function ScraperDashboard() {
  const [targetUrl, setTargetUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleScrape = async (e) => {
    e.preventDefault();
    if (!targetUrl) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Connexion au backend FastAPI en local sur le port 8000
      const response = await fetch('http://localhost:8000/scrape-and-save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ target_url: targetUrl }),
      });

      if (!response.ok) {
        throw new Error(`Erreur HTTP : ${response.status}`);
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err.message || 'Impossible de joindre le backend FastAPI sur http://localhost:8000.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-200 dark:border-gray-800">
      <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">
        🚀 Panneau d&apos;Agrégation & Scraping
      </h2>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Saisissez l&apos;URL de la source cible pour lancer l&apos;extraction automatique et alimenter votre base de données Supabase.
      </p>

      <form onSubmit={handleScrape} className="flex flex-col sm:flex-row gap-4 mb-6">
        <input
          type="url"
          value={targetUrl}
          onChange={(e) => setTargetUrl(e.target.value)}
          placeholder="https://exemple.com/annuaire-ou-offres"
          required
          className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors cursor-pointer"
        >
          {loading ? 'Extraction en cours...' : 'Lancer le Scraping'}
        </button>
      </form>

      {error && (
        <div className="p-4 mb-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          <strong>Erreur :</strong> {error}
        </div>
      )}

      {result && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-white">
            📊 Rapport de l&apos;opération
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="p-3 bg-white dark:bg-gray-900 rounded-md shadow-sm border border-gray-100 dark:border-gray-800">
              <span className="block text-xs text-gray-500">Total Extrait</span>
              <span className="text-xl font-bold text-blue-600">{result.scraped_total || 0}</span>
            </div>
            <div className="p-3 bg-white dark:bg-gray-900 rounded-md shadow-sm border border-gray-100 dark:border-gray-800">
              <span className="block text-xs text-gray-500">Nouveaux Ajoutés</span>
              <span className="text-xl font-bold text-green-600">{result.newly_saved || 0}</span>
            </div>
            <div className="p-3 bg-white dark:bg-gray-900 rounded-md shadow-sm border border-gray-100 dark:border-gray-800">
              <span className="block text-xs text-gray-500">Doublons Ignorés</span>
              <span className="text-xl font-bold text-yellow-600">{result.duplicates_ignored || 0}</span>
            </div>
            <div className="p-3 bg-white dark:bg-gray-900 rounded-md shadow-sm border border-gray-100 dark:border-gray-800">
              <span className="block text-xs text-gray-500">Erreurs</span>
              <span className="text-xl font-bold text-red-600">{result.errors?.length || 0}</span>
            </div>
          </div>

          {result.errors && result.errors.length > 0 && (
            <div className="mt-2">
              <h4 className="text-sm font-semibold text-red-600 mb-1">Détails des erreurs :</h4>
              <ul className="list-disc list-inside text-xs text-gray-600 dark:text-gray-400">
                {result.errors.map((err, idx) => (
                  <li key={idx}>Item &quot;{err.name || 'Inconnu'}&quot;: {err.error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
