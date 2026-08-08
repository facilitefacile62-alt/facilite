"use client";

import React from 'react';
import { useRouter } from 'next/navigation';

export default function CanvaConnectButton() {
  const router = useRouter();

  const handleConnect = () => {
    // Redirige vers notre route backend pour initier le flux OAuth
    router.push('/api/canva/auth');
  };

  return (
    <button
      onClick={handleConnect}
      className="flex items-center justify-center gap-3 px-6 py-3 bg-[#00C4CC] hover:bg-[#00A1A8] text-white font-semibold rounded-xl shadow-md transition-all duration-300 transform hover:-translate-y-1 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-[#00C4CC]/50"
    >
      <svg
        className="w-6 h-6"
        viewBox="0 0 24 24"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Icône simplifiée Canva */}
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
      </svg>
      Se connecter à Canva
    </button>
  );
}
