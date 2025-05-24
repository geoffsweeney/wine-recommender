import Link from "next/link";

export default function Navigation() {
  return (
    <nav className="bg-burgundy-800 text-white shadow-lg">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-2xl font-bold">WineRecommender</span>
          </Link>
          
          <div className="hidden md:flex items-center space-x-6">
            <Link href="/preferences" className="hover:text-burgundy-200 transition-colors">
              Preferences
            </Link>
            <Link href="/recommendations" className="hover:text-burgundy-200 transition-colors">
              Recommendations
            </Link>
            <Link href="/profile" className="hover:text-burgundy-200 transition-colors">
              Profile
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
