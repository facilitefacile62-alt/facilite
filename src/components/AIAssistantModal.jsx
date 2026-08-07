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
      className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 group focus:outline-none"
      aria-label="Assistant IA"
    >
      <div className="relative">
        <i className="fa-solid fa-comment-dots text-2xl transition-transform duration-300 group-hover:scale-110"></i>
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border border-white animate-pulse"></span>
      </div>
    </Link>
  );
}
