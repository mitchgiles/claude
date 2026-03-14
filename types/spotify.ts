export interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: {
    name: string;
    images: { url: string; width: number; height: number }[];
  };
  duration_ms: number;
  uri: string;
  preview_url: string | null;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string;
  images: { url: string }[];
  tracks: {
    total: number;
  };
  owner: { display_name: string };
}

export interface AudioFeatures {
  id: string;
  tempo: number;         // BPM
  energy: number;       // 0.0 to 1.0
  danceability: number; // 0.0 to 1.0
  valence: number;      // 0.0 to 1.0 (musical positivity)
  loudness: number;     // dB
  acousticness: number; // 0.0 to 1.0
  duration_ms: number;
}

export interface PlaylistTrack {
  track: SpotifyTrack;
}

export interface PlaylistTracksResponse {
  items: PlaylistTrack[];
  total: number;
  next: string | null;
}

export type WorkoutIntensity =
  | 'warmup'
  | 'recovery'
  | 'steady'
  | 'seated-climb'
  | 'standing-climb'
  | 'interval'
  | 'sprint'
  | 'cooldown';

export interface WorkoutSegment {
  track: SpotifyTrack;
  features: AudioFeatures;
  intensity: WorkoutIntensity;
  instruction: string;
  resistance: number; // 1-10
  cadence: number;    // RPM suggestion
  startTime: number;  // seconds from start
  duration: number;   // seconds
}

export interface SpinClass {
  id: string;
  name: string;
  totalDuration: number; // seconds
  segments: WorkoutSegment[];
  playlistName: string;
  createdAt: string;
  stats: {
    avgBPM: number;
    avgEnergy: number;
    peakIntensityTrack: string;
    totalCaloriesEstimate: number;
  };
}
