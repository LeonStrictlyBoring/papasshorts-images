import Link from "next/link";

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold text-navy">Settings</h1>
      <Link
        href="/settings/create"
        className="self-start flex items-center gap-2 bg-orange text-white text-sm font-medium px-4 py-2 rounded hover:bg-orange/90 transition-colors"
      >
        + Setting erstellen
      </Link>
    </div>
  );
}
