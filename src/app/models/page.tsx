import Link from "next/link";

export default function ModelsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold text-navy">Models</h1>
      <Link
        href="/models/create"
        className="self-start flex items-center gap-2 bg-orange text-white text-sm font-medium px-4 py-2 rounded hover:bg-orange/90 transition-colors"
      >
        + Model erstellen
      </Link>
    </div>
  );
}
