"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Dashboard", href: "/" },
  { label: "Models", href: "/models" },
  { label: "Artikel", href: "/artikel" },
  { label: "Settings", href: "/settings" },
  { label: "Shootings", href: "/shootings" },
  { label: "Profil", href: "/profil" },
];

export default function Sidebar() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <aside className="w-56 bg-navy flex-none flex flex-col overflow-y-auto">
      <nav className="flex-1 py-4">
        <ul>
          {navItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center px-6 py-3 text-sm font-medium transition-colors ${
                  isActive(item.href)
                    ? "bg-white/10 text-white border-l-4 border-orange"
                    : "text-white/60 hover:bg-white/5 hover:text-white border-l-4 border-transparent"
                }`}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
