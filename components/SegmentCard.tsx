'use client';

import { WorkoutSegment } from '@/types/spotify';
import {
  formatDuration,
  getIntensityColor,
  getIntensityLabel,
  getIntensityEmoji,
} from '@/lib/workout-generator';

interface Props {
  segment: WorkoutSegment;
  index: number;
  isActive?: boolean;
}

export default function SegmentCard({ segment, index, isActive }: Props) {
  const { track, features, intensity, instruction, resistance, cadence, startTime, duration } = segment;
  const albumArt = track.album.images[0]?.url;
  const artists = track.artists.map((a) => a.name).join(', ');
  const colorClass = getIntensityColor(intensity);

  return (
    <div
      className={`flex gap-4 p-4 rounded-xl border transition-all ${
        isActive
          ? 'border-green-500 bg-gray-800 shadow-lg shadow-green-900/20'
          : 'border-gray-700 bg-gray-900 hover:border-gray-600'
      }`}
    >
      {/* Track number + time */}
      <div className="flex-shrink-0 w-10 text-center">
        <p className="text-xs text-gray-500 font-mono">{index + 1}</p>
        <p className="text-xs text-gray-600 font-mono mt-1">{formatDuration(startTime)}</p>
      </div>

      {/* Album art */}
      {albumArt ? (
        <img
          src={albumArt}
          alt={track.album.name}
          className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-14 h-14 rounded-lg bg-gray-700 flex items-center justify-center flex-shrink-0">
          <span className="text-2xl">🎵</span>
        </div>
      )}

      {/* Track info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-white truncate">{track.name}</p>
            <p className="text-sm text-gray-400 truncate">{artists}</p>
          </div>
          <div className={`${colorClass} px-2 py-0.5 rounded-full text-xs text-white font-medium flex-shrink-0`}>
            {getIntensityEmoji(intensity)} {getIntensityLabel(intensity)}
          </div>
        </div>

        <p className="text-sm text-gray-300 mt-1.5 italic">{instruction}</p>

        {/* Stats row */}
        <div className="flex gap-4 mt-2 text-xs text-gray-500">
          <span>⏱ {formatDuration(duration)}</span>
          <span>🎵 {Math.round(features.tempo)} BPM</span>
          <span>🔧 Resistance {resistance}/10</span>
          <span>🔄 {cadence} RPM</span>
          <span>⚡ Energy {Math.round(features.energy * 100)}%</span>
        </div>
      </div>
    </div>
  );
}
