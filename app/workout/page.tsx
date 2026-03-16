'use client';

import { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import SegmentCard from '@/components/SegmentCard';
import WorkoutTimeline from '@/components/WorkoutTimeline';
import StatsCard from '@/components/StatsCard';
import { useSpotifyPlayer } from '@/hooks/useSpotifyPlayer';
import { SpinClass } from '@/types/spotify';
import { formatDuration } from '@/lib/workout-generator';

function WorkoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get('id');

  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const lastPlayedIndex = useRef<number | null>(null);

  const { deviceId, isReady, error: sdkError, isMobile } = useSpotifyPlayer();

  const spinClass = useMemo<SpinClass | null>(() => {
    if (!id) return null;
    const stored = sessionStorage.getItem(`spinClass-${id}`);
    return stored ? (JSON.parse(stored) as SpinClass) : null;
  }, [id]);

  useEffect(() => {
    if (!id || !spinClass) router.push('/dashboard');
  }, [id, router, spinClass]);

  const playTrack = async (trackUri: string) => {
    setPlaybackError(null);
    try {
      const body: Record<string, string> = { uri: trackUri };
      // Desktop: target the SDK virtual device. Mobile: omit deviceId so
      // Spotify targets whichever Connect device is currently active.
      if (deviceId) body.deviceId = deviceId;

      const res = await fetch('/api/spotify/player', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = data.error ?? `Playback error (${res.status})`;
        // 404 on mobile = no active Spotify device
        setPlaybackError(
          res.status === 404 && isMobile
            ? 'Open the Spotify app first, then press Start Workout.'
            : msg
        );
      }
    } catch (e) {
      setPlaybackError(String(e));
    }
  };

  // Workout timer
  useEffect(() => {
    if (!isPlaying || !spinClass) return;
    const interval = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        if (next >= spinClass.totalDuration) {
          setIsPlaying(false);
          return spinClass.totalDuration;
        }
        const idx = spinClass.segments.findIndex(
          (seg) => next >= seg.startTime && next < seg.startTime + seg.duration
        );
        if (idx !== -1) setActiveIndex(idx);
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying, spinClass]);

  // Switch tracks when activeIndex changes
  useEffect(() => {
    if (activeIndex === null || !spinClass || !isPlaying) return;
    if (activeIndex === lastPlayedIndex.current) return;
    lastPlayedIndex.current = activeIndex;
    playTrack(`spotify:track:${spinClass.segments[activeIndex].track.id}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, isPlaying]);

  if (!spinClass) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const { segments, stats, totalDuration, playlistName } = spinClass;
  const minutes = Math.floor(totalDuration / 60);
  const progressPct = (elapsed / totalDuration) * 100;
  const currentSegment = activeIndex !== null ? segments[activeIndex] : null;

  const canStart = isReady && !sdkError;
  const statusMsg = sdkError
    ? sdkError
    : !isReady
    ? 'Connecting to Spotify…'
    : null;

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 bg-gray-950 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Link href="/dashboard" className="text-gray-400 hover:text-white p-1 shrink-0">←</Link>
            <span className="text-white font-semibold truncate text-sm sm:text-base">{playlistName}</span>
          </div>
          <a href="/api/auth/logout" className="text-gray-500 hover:text-white text-sm shrink-0 ml-2">Log out</a>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-8 space-y-4 sm:space-y-8">

        {/* Workout controls */}
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4 sm:p-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">Spin Class</h1>
              <p className="text-gray-400 text-sm">{segments.length} tracks • {minutes} min</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  setElapsed(0);
                  setActiveIndex(null);
                  setIsPlaying(false);
                  lastPlayedIndex.current = null;
                }}
                className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
              >
                Reset
              </button>
              <button
                disabled={!canStart}
                onClick={() => {
                  const starting = !isPlaying;
                  setIsPlaying((p) => !p);
                  if (starting && activeIndex === null) {
                    setActiveIndex(0);
                    lastPlayedIndex.current = null;
                  }
                }}
                className={`px-5 py-2 rounded-full font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  isPlaying
                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                    : 'bg-green-500 hover:bg-green-400 text-black'
                }`}
              >
                {isPlaying ? '⏸ Pause' : '▶ Start'}
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>{formatDuration(elapsed)}</span>
              <span>{formatDuration(totalDuration)}</span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-1000"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Mobile hint */}
          {isMobile && !isPlaying && !playbackError && (
            <div className="mb-3 p-3 bg-blue-900/30 border border-blue-700 rounded-xl text-blue-300 text-xs">
              Open the Spotify app on your phone before pressing Start — music will play there while you follow the workout here.
            </div>
          )}

          {/* SDK status / errors */}
          {(statusMsg || playbackError) && (
            <div className={`p-3 rounded-xl text-sm mb-3 ${
              sdkError || playbackError
                ? 'bg-red-900/30 border border-red-700 text-red-300'
                : 'bg-gray-800 border border-gray-700 text-gray-400'
            }`}>
              {playbackError ?? statusMsg}
              {(sdkError ?? '').includes('Premium') && (
                <span className="block mt-1 text-xs text-red-400">
                  Spotify Premium is required for in-browser playback.
                </span>
              )}
            </div>
          )}

          {/* Now playing */}
          {currentSegment && isPlaying ? (
            <div className="p-3 bg-green-900/30 border border-green-700 rounded-xl">
              <p className="text-green-300 text-sm font-medium leading-snug">
                NOW: {currentSegment.track.name}
              </p>
              <p className="text-green-400/70 text-xs mt-0.5">{currentSegment.instruction}</p>
            </div>
          ) : (
            <div className="p-3 bg-gray-800 rounded-xl">
              <p className="text-gray-500 text-sm">
                {canStart ? 'Press Start to begin' : 'Waiting for Spotify…'}
              </p>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <StatsCard icon="⏱" label="Duration" value={`${minutes} min`} />
          <StatsCard icon="🎵" label="Avg BPM" value={stats.avgBPM} sublabel="beats/min" />
          <StatsCard icon="⚡" label="Energy" value={`${stats.avgEnergy}%`} sublabel="Spotify score" />
          <StatsCard icon="🔥" label="Calories" value={stats.totalCaloriesEstimate} sublabel="estimate" />
        </div>

        {/* Timeline */}
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold text-white mb-4">Workout Timeline</h2>
          <WorkoutTimeline spinClass={spinClass} />
        </div>

        {/* Track list */}
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">
            Track Breakdown
            <span className="text-gray-500 font-normal text-sm ml-2">({segments.length})</span>
          </h2>
          <div className="space-y-3">
            {segments.map((segment, i) => (
              <SegmentCard
                key={segment.track.id + i}
                segment={segment}
                index={i}
                isActive={activeIndex === i && isPlaying}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WorkoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <WorkoutContent />
    </Suspense>
  );
}
