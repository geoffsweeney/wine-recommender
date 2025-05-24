import Link from 'next/link';
import ChatUI from '../../components/ChatUI'; // Import ChatUI component

export default function Home() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold text-center text-burgundy-800 mb-8">Wine Recommender Application</h1>

      {/* Navigation link to the preferences page */}
      <div className="text-center mb-8">
        <Link href="/preferences" className="text-burgundy-600 hover:underline text-lg">
          Manage Preferences
        </Link>
      </div>

      {/* Render the ChatUI component */}
      <ChatUI />
    </div>
  );
}