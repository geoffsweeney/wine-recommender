import Link from 'next/link';
import ChatUI from '../../components/ChatUI'; // Import ChatUI component

export default function Home() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Wine Recommender Application</h1>

      {/* Navigation link to the preferences page */}
      <div className="mb-4">
        <Link href="/preferences" className="text-blue-600 hover:underline">
          Manage Preferences
        </Link>
      </div>

      {/* Render the ChatUI component */}
      <ChatUI />
    </div>
  );
}