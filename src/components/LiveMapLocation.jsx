'use client';

import { useState, useEffect } from 'react';

export default function LiveMapLocation({ onLocationUpdate }) {
  const [coords, setCoords] = useState(null);
  const [error, setError] = useState(null);
  const [isTracking, setIsTracking] = useState(false);

  useEffect(() => {
    let watcherId = null;

    if (isTracking && typeof window !== 'undefined' && 'geolocation' in navigator) {
      watcherId = navigator.geolocation.watchPosition(
        (position) => {
          const currentCoords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: Math.round(position.coords.accuracy),
          };
          setCoords(currentCoords);
          setError(null);
          if (onLocationUpdate) {
            onLocationUpdate(currentCoords);
          }
        },
        (err) => {
          setError("Impossible d'accéder au GPS. Veuillez autoriser la localisation.");
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    }

    return () => {
      if (watcherId !== null && typeof window !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watcherId);
      }
    };
  }, [isTracking, onLocationUpdate]);

  const openGoogleMapsRoute = () => {
    if (!coords) return;
    const url = `https://www.google.com/maps/dir/?api=1&origin=${coords.lat},${coords.lng}`;
    window.open(url, '_blank');
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          📍 Position GPS en direct
        </h3>
        <button
          type="button"
          onClick={() => setIsTracking(!isTracking)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
            isTracking
              ? 'bg-red-500 text-white animate-pulse'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
          }`}
        >
          {isTracking ? 'Arrêter' : 'Activer GPS'}
        </button>
      </div>

      {coords ? (
        <div className="space-y-4">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-sm space-y-1">
            <p className="text-slate-600 dark:text-slate-300">
              <span className="font-semibold text-slate-900 dark:text-slate-100">Latitude :</span> {coords.lat.toFixed(5)}
            </p>
            <p className="text-slate-600 dark:text-slate-300">
              <span className="font-semibold text-slate-900 dark:text-slate-100">Longitude :</span> {coords.lng.toFixed(5)}
            </p>
            <p className="text-xs text-slate-400">Précision : ±{coords.accuracy} m</p>
          </div>

          <div className="w-full h-48 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
            <iframe
              title="Aperçu carte dynamique"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              loading="lazy"
              src={`https://maps.google.com/maps?q=${coords.lat},${coords.lng}&z=15&output=embed`}
            />
          </div>

          <button
            type="button"
            onClick={openGoogleMapsRoute}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-sm flex items-center justify-center gap-2 transition shadow-sm cursor-pointer"
          >
            🧭 Calculer un itinéraire Google Maps
          </button>
        </div>
      ) : (
        <p className="text-sm text-slate-500 text-center py-6">
          {error || "Cliquez sur 'Activer GPS' pour localiser votre position exacte en temps réel."}
        </p>
      )}
    </div>
  );
}
