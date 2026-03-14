'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import SegmentCard from '@/components/SegmentCard';
import WorkoutTimeline from '@/components/WorkoutTimeline';
import StatsCard from '@/components/StatsCard';
import { SpinClass } from '@/types/spotify';
import { formatDuration } from '@/lib/workout-generator';

function WorkoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get('id');

  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const spinClass = useMemo<SpinClass | null>(() => {
    if (!id) return null;
    const stored = sessionStorage.getItem(`spinClass-${id}`);
    return stored ? (JSON.parse(stored) as SpinClass) : null;
  }, [id]);

  useEffect(() => {
    if (!id || !spinClass) router.push('/dashboard');
  }, [id, router, spinClass]);

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

  // Track ID driving the embed iframe. Only set once the workout starts so
  // the iframe mounts for the first time inside the click handler's event,
  // which satisfies the browser's autoplay policy.
  const embedTrackId = activeIndex !== null ? segments[activeIndex].track.id : null;

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-gray-400 hover:text-white transition-colors p-1">
              ←
            </Link>
            <span className="text-white font-semibold truncate">{playlistName}</span>
          </div>
          <div className="flex items-center gap-2">
            <a href="/api/auth/logout" className="text-gray-500 hover:text-white text-sm transition-colors">
              Log out
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">

        {/* Workout controls */}
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Spin Class</h1>
              <p className="text-gray-400">{segments.length} tracks • {minutes} minutes</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setElapsed(0); setActiveIndex(null); setIsPlaying(false); }}
                className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
              >
                Reset
              </button>
              <button
                onClick={() => {
                  const starting = !isPlaying;
                  setIsPlaying((p) => !p);
                  // Set activeIndex synchronously inside the click so the iframe
                  // mounts (with autoplay=1) while the user gesture is still active.
                  if (starting && activeIndex === null) setActiveIndex(0);
                }}
                className={`px-6 py-2 rounded-full font-semibold text-sm transition-all ${
                  isPlaying
                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                    : 'bg-green-500 hover:bg-green-400 text-black'
                }`}
              >
                {isPlaying ? '⏸ Pause' : '▶ Start Workout'}
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

          {/* Spotify embed — mounts only after Start is clicked; key forces a
              full remount (and thus autoplay) whenever the track changes. */}
          {embedTrackId ? (
            <iframe
              key={embedTrackId}
              src={`https://open.spotify.com/embed/track/${embedTrackId}?utm_source=generator&autoplay=1`}
              width="100%"
              height="152"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              className="rounded-xl border-0"
            />
          ) : (
            <div className="h-[152px] bg-gray-800 rounded-xl flex items-center justify-center">
              <p className="text-gray-500 text-sm">Press Start Workout to begin</p>
            </div>
          )}

          {/* Current segment callout */}
          {currentSegment && isPlaying && (
            <div className="mt-4 p-3 bg-green-900/30 border border-green-700 rounded-xl">
              <p className="text-green-300 text-sm font-medium">
                NOW: {currentSegment.track.name} — {currentSegment.instruction}
              </p>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatsCard icon="⏱" label="Total Duration" value={`${minutes} min`} />
          <StatsCard icon="🎵" label="Avg BPM" value={stats.avgBPM} sublabel="beats per minute" />
          <StatsCard icon="⚡" label="Avg Energy" value={`${stats.avgEnergy}%`} sublabel="Spotify energy score" />
          <StatsCard icon="🔥" label="Est. Calories" value={stats.totalCaloriesEstimate} sublabel="rough estimate" />
        </div>

        {/* Timeline */}
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Workout Timeline</h2>
          <WorkoutTimeline spinClass={spinClass} />
        </div>

        {/* Track list */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">
            Track Breakdown
            <span className="text-gray-500 font-normal text-sm ml-2">({segments.length} segments)</span>
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
