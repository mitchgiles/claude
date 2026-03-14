'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import PlaylistCard from '@/components/PlaylistCard';
import { SpotifyPlaylist, SpotifyTrack, AudioFeatures, SpinClass } from '@/types/spotify';
import { generateSpinClass } from '@/lib/workout-generator';

/** Extract playlist ID from a Spotify URL or URI, or return the raw value if it's already an ID. */
function parseSpotifyPlaylistId(input: string): string | null {
  const trimmed = input.trim();
  // https://open.spotify.com/playlist/37i9dQZF1DX...
  const urlMatch = trimmed.match(/spotify\.com\/playlist\/([A-Za-z0-9]+)/);
  if (urlMatch) return urlMatch[1];
  // spotify:playlist:37i9dQZF1DX...
  const uriMatch = trimmed.match(/^spotify:playlist:([A-Za-z0-9]+)$/);
  if (uriMatch) return uriMatch[1];
  // bare ID (22 alphanumeric chars)
  if (/^[A-Za-z0-9]{22}$/.test(trimmed)) return trimmed;
  return null;
}

export default function DashboardPage() {
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<SpotifyPlaylist | null>(null);
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [spinClass, setSpinClass] = useState<SpinClass | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const LIMIT = 20;

  const fetchPlaylists = useCallback(async (newOffset: number) => {
    setIsLoadingPlaylists(true);
    try {
      const res = await fetch(`/api/spotify/playlists?limit=${LIMIT}&offset=${newOffset}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      if (res.status === 401) {
        setPlaylists([]);
        window.location.href = '/?error=session_expired';
        return;
      }
      const data = await res.json();
      if (newOffset === 0) {
        setPlaylists(data.items || []);
      } else {
        setPlaylists((prev) => [...prev, ...(data.items || [])]);
      }
      setHasMore(!!data.next);
      setOffset(newOffset + LIMIT);
    } catch {
      setError('Failed to load playlists. Please try again.');
    } finally {
      setIsLoadingPlaylists(false);
    }
  }, []);

  useEffect(() => {
    fetchPlaylists(0);
  }, [fetchPlaylists]);

  async function handleGenerateWorkout(playlist: SpotifyPlaylist) {
    setSelectedPlaylist(playlist);
    setSpinClass(null);
    setIsGenerating(true);
    setError(null);

    try {
      // 1. Fetch tracks
      const tracksRes = await fetch(`/api/spotify/tracks?playlistId=${playlist.id}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      if (tracksRes.status === 401) {
        const body = await tracksRes.json().catch(() => ({}));
        throw new Error(`Auth failed — debug: ${JSON.stringify(body.debug ?? body)}`);
      }
      if (!tracksRes.ok) {
        const errData = await tracksRes.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to fetch tracks (${tracksRes.status})`);
      }
      const tracksData = await tracksRes.json();

      // /items endpoint returns { item: track } (not { track: track })
      const tracks: SpotifyTrack[] = tracksData.items
        .map((item: { item?: SpotifyTrack; track?: SpotifyTrack }) => item.item ?? item.track)
        .filter((t: SpotifyTrack | null) => t && t.id && (t as { type?: string }).type !== 'episode');

      if (tracks.length === 0) throw new Error('No tracks found in this playlist');

      // 2. Fetch audio features (optional — deprecated for some Spotify apps)
      let featuresMap = new Map<string, AudioFeatures>();
      try {
        const ids = tracks.map((t) => t.id).join(',');
        const featuresRes = await fetch(`/api/spotify/features?ids=${ids}`, {
          credentials: 'include',
          cache: 'no-store',
        });
        if (featuresRes.ok) {
          const featuresData = await featuresRes.json();
          featuresMap = new Map<string, AudioFeatures>(
            (featuresData.audio_features as AudioFeatures[])
              .filter(Boolean)
              .map((f) => [f.id, f])
          );
        } else {
          console.warn('Audio features unavailable, generating workout without BPM data');
        }
      } catch {
        console.warn('Audio features fetch failed, generating workout without BPM data');
      }

      // 3. Combine tracks with features; fall back to tracks without features
      const tracksWithFeatures = tracks
        .map((track) => ({ track, features: featuresMap.get(track.id) }))
        .filter((t): t is { track: SpotifyTrack; features: AudioFeatures } => !!t.features);

      const inputTracks = tracksWithFeatures.length > 0 ? tracksWithFeatures : tracks.map((track) => ({
        track,
        features: { id: track.id, tempo: 128, energy: 0.7, valence: 0.5, danceability: 0.6 } as AudioFeatures,
      }));

      // 4. Generate spin class
      const generated = generateSpinClass(inputTracks, playlist.name);
      setSpinClass(generated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleUrlSubmit(e: React.FormEvent) {
    e.preventDefault();
    setUrlError(null);
    const playlistId = parseSpotifyPlaylistId(urlInput);
    if (!playlistId) {
      setUrlError('Paste a Spotify playlist URL, URI, or ID');
      return;
    }
    try {
      const res = await fetch(`/api/spotify/playlist?id=${playlistId}`, { credentials: 'include', cache: 'no-store' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setUrlError(body.error || 'Could not load that playlist');
        return;
      }
      const playlist: SpotifyPlaylist = await res.json();
      setUrlInput('');
      handleGenerateWorkout(playlist);
    } catch {
      setUrlError('Could not load that playlist');
    }
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950 sticky top-0 z-20 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-white font-bold text-xl">
            <span className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center text-base">🚴</span>
            SpinSync
          </Link>
          <a
            href="/api/auth/logout"
            className="text-gray-400 hover:text-white text-sm transition-colors"
          >
            Log out
          </a>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8 flex gap-6 flex-col lg:flex-row">
        {/* Playlist sidebar */}
        <aside className="w-full lg:w-80 flex-shrink-0">
          <h2 className="text-lg font-semibold text-white mb-4">Your Playlists</h2>

          {/* Paste any Spotify playlist URL */}
          <form onSubmit={handleUrlSubmit} className="mb-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={urlInput}
                onChange={(e) => { setUrlInput(e.target.value); setUrlError(null); }}
                placeholder="Paste Spotify playlist URL…"
                className="flex-1 min-w-0 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
              />
              <button
                type="submit"
                disabled={isGenerating || !urlInput.trim()}
                className="px-3 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white text-sm rounded-lg transition-colors shrink-0"
              >
                Go
              </button>
            </div>
            {urlError && <p className="mt-1 text-xs text-red-400">{urlError}</p>}
          </form>

          {error && !isGenerating && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-2">
            {isLoadingPlaylists && playlists.length === 0 ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-20 bg-gray-800 rounded-xl animate-pulse" />
              ))
            ) : (
              playlists.map((playlist) => (
                <PlaylistCard
                  key={playlist.id}
                  playlist={playlist}
                  onSelect={handleGenerateWorkout}
                  isSelected={selectedPlaylist?.id === playlist.id}
                  isLoading={isGenerating}
                />
              ))
            )}
          </div>

          {hasMore && (
            <button
              onClick={() => fetchPlaylists(offset)}
              disabled={isLoadingPlaylists}
              className="mt-4 w-full py-2 text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg transition-colors disabled:opacity-50"
            >
              {isLoadingPlaylists ? 'Loading...' : 'Load more'}
            </button>
          )}
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          {!selectedPlaylist && !spinClass && (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <p className="text-5xl mb-4">👈</p>
              <h3 className="text-xl font-semibold text-white mb-2">Pick a playlist</h3>
              <p className="text-gray-400">
                Select any playlist from the sidebar to generate a spin class workout.
              </p>
            </div>
          )}

          {isGenerating && (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-white font-semibold">Analyzing your music...</p>
              <p className="text-gray-400 text-sm mt-1">
                Fetching audio features for &ldquo;{selectedPlaylist?.name}&rdquo;
              </p>
            </div>
          )}

          {error && isGenerating === false && selectedPlaylist && !spinClass && (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <p className="text-4xl mb-4">😕</p>
              <p className="text-red-400 font-semibold">{error}</p>
              <button
                onClick={() => selectedPlaylist && handleGenerateWorkout(selectedPlaylist)}
                className="mt-4 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm transition-colors"
              >
                Try again
              </button>
            </div>
          )}

          {spinClass && !isGenerating && (
            <Link
              href={`/workout?id=${spinClass.id}`}
              onClick={() => {
                sessionStorage.setItem(`spinClass-${spinClass.id}`, JSON.stringify(spinClass));
              }}
              className="block"
            >
              <SpinClassPreview spinClass={spinClass} />
            </Link>
          )}
        </main>
      </div>
    </div>
  );
}

function SpinClassPreview({ spinClass }: { spinClass: SpinClass }) {
  const { stats, segments, totalDuration, playlistName } = spinClass;
  const minutes = Math.floor(totalDuration / 60);

  // Count intensity types
  const intensityCounts = segments.reduce<Record<string, number>>((acc, s) => {
    acc[s.intensity] = (acc[s.intensity] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="bg-gray-900 border border-green-600 rounded-2xl p-6 hover:border-green-400 transition-colors cursor-pointer group">
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-green-400 text-sm font-medium mb-1">Workout Generated!</p>
          <h2 className="text-2xl font-bold text-white">{playlistName}</h2>
          <p className="text-gray-400 mt-1">{segments.length} tracks • {minutes} minutes</p>
        </div>
        <span className="text-gray-400 group-hover:text-white transition-colors text-sm flex items-center gap-1">
          View full workout →
        </span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { icon: '⏱', label: 'Duration', value: `${minutes} min` },
          { icon: '🎵', label: 'Avg BPM', value: stats.avgBPM },
          { icon: '⚡', label: 'Avg Energy', value: `${stats.avgEnergy}%` },
          { icon: '🔥', label: 'Est. Calories', value: stats.totalCaloriesEstimate },
        ].map(({ icon, label, value }) => (
          <div key={label} className="bg-gray-800 rounded-xl p-3">
            <p className="text-xl mb-1">{icon}</p>
            <p className="text-white font-bold text-lg">{value}</p>
            <p className="text-gray-400 text-xs">{label}</p>
          </div>
        ))}
      </div>

      {/* Intensity breakdown */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(intensityCounts).map(([intensity, count]) => (
          <span
            key={intensity}
            className="px-3 py-1 bg-gray-800 rounded-full text-xs text-gray-300"
          >
            {intensity.replace('-', ' ')} × {count}
          </span>
        ))}
      </div>
    </div>
  );
}
