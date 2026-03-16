import {
  SpotifyTrack,
  AudioFeatures,
  WorkoutIntensity,
  WorkoutSegment,
  SpinClass,
} from '@/types/spotify';

interface TrackWithFeatures {
  track: SpotifyTrack;
  features: AudioFeatures;
}

/**
 * Determines spin class intensity based on audio features.
 *
 * Intensity mapping:
 * - Sprint:         tempo >145 + energy >0.85
 * - Standing climb: tempo 125-145 + energy >0.75, or tempo >145 + energy 0.65-0.85
 * - Interval:       high danceability (>0.8) + energy >0.7
 * - Seated climb:   tempo 115-135 + energy 0.55-0.80
 * - Steady:         tempo 110-130 + energy 0.4-0.65
 * - Recovery:       energy <0.5 (mid-workout)
 * - Warmup/Cooldown: assigned positionally
 */
function classifyIntensity(
  features: AudioFeatures,
  position: 'start' | 'end' | 'middle'
): WorkoutIntensity {
  const { tempo, energy, danceability } = features;

  if (position === 'start') return 'warmup';
  if (position === 'end') return 'cooldown';

  if (tempo > 145 && energy > 0.85) return 'sprint';
  if (tempo > 145 && energy > 0.65) return 'standing-climb';
  if (tempo >= 125 && energy > 0.75) return 'standing-climb';
  if (danceability > 0.8 && energy > 0.7) return 'interval';
  if (tempo >= 115 && energy >= 0.55) return 'seated-climb';
  if (energy < 0.45) return 'recovery';
  return 'steady';
}

function getResistance(intensity: WorkoutIntensity): number {
  const map: Record<WorkoutIntensity, number> = {
    warmup: 3,
    cooldown: 2,
    recovery: 3,
    steady: 5,
    'seated-climb': 6,
    interval: 7,
    'standing-climb': 8,
    sprint: 4, // high speed, lower resistance
  };
  return map[intensity];
}

function getCadence(intensity: WorkoutIntensity, tempo: number): number {
  // Cadence in RPM — spin bikes typically 60-110 RPM
  // Map BPM to cadence (usually half-time or in sync with music)
  const halfTime = Math.round(tempo / 2);
  const map: Record<WorkoutIntensity, number> = {
    warmup: Math.min(Math.max(halfTime, 60), 75),
    cooldown: Math.min(Math.max(halfTime, 55), 70),
    recovery: Math.min(Math.max(halfTime, 60), 75),
    steady: Math.min(Math.max(halfTime, 70), 90),
    'seated-climb': Math.min(Math.max(halfTime, 65), 85),
    interval: Math.min(Math.max(halfTime, 75), 100),
    'standing-climb': Math.min(Math.max(halfTime, 60), 80),
    sprint: Math.min(Math.max(Math.round(tempo / 1.5), 85), 110),
  };
  return map[intensity];
}

function getInstruction(intensity: WorkoutIntensity, features: AudioFeatures): string {
  const bpm = Math.round(features.tempo);
  const instructions: Record<WorkoutIntensity, string> = {
    warmup: `Warm up — easy spin, loosen your legs. Music at ${bpm} BPM.`,
    cooldown: `Cool down — reduce resistance, easy pedaling. Let your heart rate drop.`,
    recovery: `Active recovery — keep moving, light resistance. Catch your breath. ${bpm} BPM.`,
    steady: `Steady state — maintain consistent pace. ${bpm} BPM keeps you in the zone.`,
    'seated-climb': `Seated climb — increase resistance, stay seated. Drive through the burn at ${bpm} BPM.`,
    interval: `Interval push — alternate hard and easy every 30s. Let the beat at ${bpm} BPM guide you!`,
    'standing-climb': `Standing climb — rise out of the saddle, heavy resistance. Power up at ${bpm} BPM!`,
    sprint: `SPRINT — max effort, low resistance, fast legs! Chase that ${bpm} BPM tempo!`,
  };
  return instructions[intensity];
}

function getIntensityEmoji(intensity: WorkoutIntensity): string {
  const map: Record<WorkoutIntensity, string> = {
    warmup: '🌅',
    cooldown: '❄️',
    recovery: '💧',
    steady: '🚴',
    'seated-climb': '⛰️',
    interval: '⚡',
    'standing-climb': '🏔️',
    sprint: '🔥',
  };
  return map[intensity];
}

export function generateSpinClass(
  tracks: TrackWithFeatures[],
  playlistName: string,
  targetDuration?: number // seconds; if provided, selects tracks to fill ±2 min
): SpinClass {
  // Select tracks to match the target duration (greedy: add until within window)
  let selected = tracks;
  if (targetDuration != null && tracks.length > 0) {
    const minTarget = targetDuration - 120; // −2 min
    selected = [];
    let accumulated = 0;
    for (const t of tracks) {
      selected.push(t);
      accumulated += Math.round(t.track.duration_ms / 1000);
      if (accumulated >= minTarget) break;
    }
  }

  const totalTracks = selected.length;
  const segments: WorkoutSegment[] = [];
  let currentTime = 0;

  selected.forEach(({ track, features }, index) => {
    let position: 'start' | 'end' | 'middle' = 'middle';
    if (index === 0) position = 'start';
    else if (index === totalTracks - 1) position = 'end';
    // Also treat second-to-last as cooldown if playlist is long enough
    else if (totalTracks > 5 && index === totalTracks - 2) position = 'end';

    const intensity = classifyIntensity(features, position);
    const duration = Math.round(track.duration_ms / 1000);

    segments.push({
      track,
      features,
      intensity,
      instruction: getInstruction(intensity, features),
      resistance: getResistance(intensity),
      cadence: getCadence(intensity, features.tempo),
      startTime: currentTime,
      duration,
    });

    currentTime += duration;
  });

  const totalDuration = currentTime;
  const avgBPM =
    Math.round(selected.reduce((sum, t) => sum + t.features.tempo, 0) / selected.length);
  const avgEnergy =
    selected.reduce((sum, t) => sum + t.features.energy, 0) / selected.length;

  const peakSegment = segments.reduce((max, s) =>
    s.features.energy > max.features.energy ? s : max
  );

  // Rough calorie estimate: ~8-12 kcal/min for spin class based on avg energy
  const minuteDuration = totalDuration / 60;
  const calRate = 8 + avgEnergy * 4;
  const totalCaloriesEstimate = Math.round(minuteDuration * calRate);

  return {
    id: `spin-${Date.now()}`,
    name: `Spin Class: ${playlistName}`,
    totalDuration,
    segments,
    playlistName,
    createdAt: new Date().toISOString(),
    stats: {
      avgBPM,
      avgEnergy: Math.round(avgEnergy * 100),
      peakIntensityTrack: peakSegment.track.name,
      totalCaloriesEstimate,
    },
  };
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function getIntensityColor(intensity: WorkoutIntensity): string {
  const map: Record<WorkoutIntensity, string> = {
    warmup: 'bg-yellow-400',
    cooldown: 'bg-blue-300',
    recovery: 'bg-green-400',
    steady: 'bg-teal-500',
    'seated-climb': 'bg-orange-400',
    interval: 'bg-purple-500',
    'standing-climb': 'bg-red-500',
    sprint: 'bg-red-700',
  };
  return map[intensity];
}

export function getIntensityLabel(intensity: WorkoutIntensity): string {
  const map: Record<WorkoutIntensity, string> = {
    warmup: 'Warm Up',
    cooldown: 'Cool Down',
    recovery: 'Recovery',
    steady: 'Steady State',
    'seated-climb': 'Seated Climb',
    interval: 'Intervals',
    'standing-climb': 'Standing Climb',
    sprint: 'Sprint',
  };
  return map[intensity];
}

export { getIntensityEmoji };
