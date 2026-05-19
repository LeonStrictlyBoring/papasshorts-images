export default function Header() {
  return (
    <header className="h-14 bg-navy flex items-center justify-between px-6 flex-none">
      <img src="/Logo-papasshorts.png" alt="Papas Shorts" className="h-10 w-auto" />
      <div className="flex items-center gap-4 text-white text-sm">
        <span className="opacity-70">[Angemeldeter User]</span>
        <button className="opacity-70 hover:opacity-100 transition-opacity cursor-pointer">
          Logout
        </button>
      </div>
    </header>
  );
}
