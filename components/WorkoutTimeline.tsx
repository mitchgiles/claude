'use client';

import { SpinClass, WorkoutSegment } from '@/types/spotify';
import {
  formatDuration,
  getIntensityColor,
  getIntensityLabel,
  getIntensityEmoji,
} from '@/lib/workout-generator';

interface Props {
  spinClass: SpinClass;
}

function SegmentBar({ segment, totalDuration }: { segment: WorkoutSegment; totalDuration: number }) {
  const widthPct = (segment.duration / totalDuration) * 100;
  const colorClass = getIntensityColor(segment.intensity);

  return (
    <div
      className={`${colorClass} h-full rounded-sm cursor-pointer transition-all hover:opacity-80 hover:scale-y-110 relative group`}
      style={{ width: `${Math.max(widthPct, 0.5)}%` }}
      title={segment.track.name}
    >
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 pointer-events-none">
        <div className="bg-gray-900 text-white text-xs rounded-lg p-2 whitespace-nowrap shadow-lg border border-gray-700">
          <p className="font-semibold">{segment.track.name}</p>
          <p className="text-gray-300">{segment.track.artists.map((a) => a.name).join(', ')}</p>
          <p className="text-gray-400">{getIntensityEmoji(segment.intensity)} {getIntensityLabel(segment.intensity)}</p>
          <p className="text-gray-400">{formatDuration(segment.duration)} • {Math.round(segment.features.tempo)} BPM</p>
        </div>
      </div>
    </div>
  );
}

export default function WorkoutTimeline({ spinClass }: Props) {
  const { segments, totalDuration } = spinClass;

  return (
    <div className="space-y-4">
      {/* Timeline bar */}
      <div className="flex items-center gap-2 h-10 rounded-lg overflow-hidden bg-gray-800 p-1">
        {segments.map((segment) => (
          <SegmentBar
            key={segment.track.id + segment.startTime}
            segment={segment}
            totalDuration={totalDuration}
          />
        ))}
      </div>

      {/* Time markers */}
      <div className="flex justify-between text-xs text-gray-500">
        <span>0:00</span>
        <span>{formatDuration(Math.floor(totalDuration / 4))}</span>
        <span>{formatDuration(Math.floor(totalDuration / 2))}</span>
        <span>{formatDuration(Math.floor((totalDuration * 3) / 4))}</span>
        <span>{formatDuration(totalDuration)}</span>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {[
          { intensity: 'warmup', label: 'Warm Up', color: 'bg-yellow-400' },
          { intensity: 'steady', label: 'Steady', color: 'bg-teal-500' },
          { intensity: 'recovery', label: 'Recovery', color: 'bg-green-400' },
          { intensity: 'seated-climb', label: 'Seated Climb', color: 'bg-orange-400' },
          { intensity: 'interval', label: 'Intervals', color: 'bg-purple-500' },
          { intensity: 'standing-climb', label: 'Standing Climb', color: 'bg-red-500' },
          { intensity: 'sprint', label: 'Sprint', color: 'bg-red-700' },
          { intensity: 'cooldown', label: 'Cool Down', color: 'bg-blue-300' },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`${color} w-3 h-3 rounded-sm`} />
            <span className="text-gray-400">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
