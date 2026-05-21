export default function Header() {
  return (
    <header className="h-14 bg-light-gray flex items-center justify-end px-6 flex-none">
      <div className="flex items-center gap-4 text-navy text-sm">
        <span className="opacity-60">[Angemeldeter User]</span>
        <button className="opacity-60 hover:opacity-100 transition-opacity cursor-pointer font-medium">
          Logout
        </button>
      </div>
    </header>
  );
}
