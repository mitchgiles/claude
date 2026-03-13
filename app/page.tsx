import Link from 'next/link';

export default function HomePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 text-center">
        {/* Logo / Brand */}
        <div className="mb-8 flex items-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/30">
            <span className="text-3xl">🚴</span>
          </div>
          <div className="text-left">
            <h1 className="text-4xl font-black text-white tracking-tight">SpinSync</h1>
            <p className="text-green-400 text-sm font-medium">Spotify Spin Class Generator</p>
          </div>
        </div>

        {/* Auth error */}
        <AuthError searchParams={searchParams} />

        {/* Tagline */}
        <h2 className="text-3xl md:text-5xl font-bold text-white max-w-2xl leading-tight mb-4">
          Turn your Spotify playlists into
          <span className="text-green-400"> epic spin classes</span>
        </h2>
        <p className="text-gray-400 text-lg max-w-xl mb-10">
          SpinSync analyzes your music's tempo, energy, and danceability to create personalized
          indoor cycling workouts. Connect Spotify and start riding in minutes.
        </p>

        {/* CTA */}
        <Link
          href="/api/auth/login"
          className="inline-flex items-center gap-3 bg-green-500 hover:bg-green-400 text-black font-bold text-lg px-8 py-4 rounded-full transition-all shadow-lg shadow-green-500/30 hover:shadow-green-400/40 hover:scale-105"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
          </svg>
          Connect with Spotify
        </Link>

        <p className="mt-4 text-gray-600 text-sm">Free to use • Requires Spotify account</p>

        {/* Features */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl w-full">
          {[
            {
              icon: '🎵',
              title: 'Music Analysis',
              desc: "Analyzes BPM, energy, danceability, and valence from Spotify's audio features API.",
            },
            {
              icon: '⚡',
              title: 'Smart Intervals',
              desc: 'Automatically maps tracks to sprint, climb, steady-state, and recovery segments.',
            },
            {
              icon: '📊',
              title: 'Visual Timeline',
              desc: 'See your entire workout laid out with intensity heatmap and per-track instructions.',
            },
          ].map(({ icon, title, desc }) => (
            <div
              key={title}
              className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-left hover:border-gray-700 transition-colors"
            >
              <p className="text-3xl mb-3">{icon}</p>
              <h3 className="text-white font-semibold text-lg mb-2">{title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-gray-600 text-sm border-t border-gray-900">
        SpinSync is not affiliated with Spotify. Uses the Spotify Web API.
      </footer>
    </div>
  );
}

const ERROR_MESSAGES: Record<string, string> = {
  auth_failed: 'Authentication failed. Please try again.',
  no_code: 'No authorization code received from Spotify.',
  access_denied: 'Spotify access was denied. Please allow access to continue.',
  session_expired: 'Your session expired. Please connect Spotify again.',
};

async function AuthError({ searchParams }: { searchParams: Promise<{ error?: string; detail?: string }> }) {
  const { error, detail } = await searchParams;
  if (!error) return null;
  const message = ERROR_MESSAGES[error] ?? `Authentication error: ${error}`;
  return (
    <div className="mb-6 px-4 py-3 bg-red-900/40 border border-red-700 rounded-xl text-red-300 text-sm max-w-md text-left">
      <p className="font-semibold">{message}</p>
      {detail && <p className="mt-1 text-red-400/70 font-mono text-xs break-all">{detail}</p>}
    </div>
  );
}
