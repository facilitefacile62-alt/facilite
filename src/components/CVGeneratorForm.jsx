"use client";
import { useState } from "react";

export default function CVGeneratorForm({ templateId }) {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    jobTitle: "",
  });
  const [loading, setLoading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [error, setError] = useState("");

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setPdfUrl(null);

    try {
      const res = await fetch("/api/generate-cv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, data: formData }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Erreur de génération");

      setPdfUrl(result.downloadUrl);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 max-w-lg mx-auto">
      <h2 className="text-xl font-bold mb-4">Générer votre CV</h2>
      {error && <div className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded">{error}</div>}
      
      {!pdfUrl ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Prénom</label>
              <input type="text" name="firstName" required onChange={handleChange} className="w-full border rounded-lg p-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Nom</label>
              <input type="text" name="lastName" required onChange={handleChange} className="w-full border rounded-lg p-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Poste ciblé</label>
            <input type="text" name="jobTitle" required onChange={handleChange} className="w-full border rounded-lg p-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Téléphone</label>
            <input type="tel" name="phone" required onChange={handleChange} className="w-full border rounded-lg p-2 text-sm" />
          </div>
          
          <button type="submit" disabled={loading} className="w-full bg-[#10E688] text-gray-900 font-extrabold py-3 rounded-lg hover:bg-emerald-400 transition disabled:opacity-50 mt-4">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <i className="fa-solid fa-spinner fa-spin"></i> Génération IA en cours...
              </span>
            ) : "Créer mon CV"}
          </button>
        </form>
      ) : (
        <div className="text-center py-6">
          <i className="fa-solid fa-circle-check text-4xl text-[#10E688] mb-3"></i>
          <h3 className="font-bold text-lg">CV généré avec succès !</h3>
          <p className="text-sm text-gray-500 mb-6">Votre CV est prêt à être téléchargé.</p>
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="bg-gray-900 text-white font-bold py-3 px-6 rounded-lg inline-flex items-center gap-2 hover:bg-gray-800 transition">
            <i className="fa-solid fa-download"></i> Télécharger le PDF
          </a>
        </div>
      )}
    </div>
  );
}
