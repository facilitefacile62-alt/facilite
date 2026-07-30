"use client";

/**
 * Pastille rouge de messages non lus (🔴), affichée en surimpression sur une
 * icône de navigation. N'affiche rien si count est 0/null.
 */
export default function UnreadBadge({ count, className = "" }) {
  if (!count || count <= 0) return null;

  return (
    <span
      className={`absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-extrabold flex items-center justify-center shadow-sm ring-2 ring-white ${className}`}
      aria-label={`${count} message${count > 1 ? "s" : ""} non lu${count > 1 ? "s" : ""}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
