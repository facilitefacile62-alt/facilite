"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AIAssistantModal() {
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleOpenRequest = () => router.push("/messagerie");
    window.addEventListener("facilite:open-ai-assistant", handleOpenRequest);
    return () => window.removeEventListener("facilite:open-ai-assistant", handleOpenRequest);
  }, [router]);

  if (!mounted) return null;

  return (
    <Link
      href="/messagerie"
      className="fixed bottom-20 md:bottom-6 right-3 sm:right-6 z-40 rounded-full flex items-center justify-center bg-transparent transition-all duration-300 hover:scale-110 active:scale-95 group focus:outline-none animate-bounce hover:animate-none shadow-2xl"
      aria-label="Assistant IA"
    >
      <div className="relative w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16">
        <img src="/ouvrier.jpg" alt="Assistant Ouvrier" className="w-full h-full rounded-full object-cover transition-transform duration-300 border-2 sm:border-4 border-white/90 group-hover:border-emerald-400 shadow-lg" />
        <span className="absolute top-0 right-0 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-emerald-400 rounded-full border-2 border-white animate-pulse shadow-sm"></span>
      </div>
    </Link>
  );
}
