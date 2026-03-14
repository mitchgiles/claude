// Minimal type declarations for the Spotify Web Playback SDK
// https://developer.spotify.com/documentation/web-playback-sdk

declare namespace Spotify {
  interface PlayerInit {
    name: string;
    getOAuthToken: (cb: (token: string) => void) => void;
    volume?: number;
  }

  interface WebPlaybackState {
    paused: boolean;
    position: number;
    track_window: { current_track: { uri: string; name: string } };
  }

  interface Player {
    connect(): Promise<boolean>;
    disconnect(): void;
    addListener(event: 'ready', cb: (args: { device_id: string }) => void): void;
    addListener(event: 'not_ready', cb: (args: { device_id: string }) => void): void;
    addListener(event: 'initialization_error' | 'authentication_error' | 'account_error', cb: (args: { message: string }) => void): void;
    addListener(event: 'player_state_changed', cb: (state: WebPlaybackState | null) => void): void;
    getCurrentState(): Promise<WebPlaybackState | null>;
    pause(): Promise<void>;
    resume(): Promise<void>;
  }

  const Player: new (init: PlayerInit) => Player;
}

interface Window {
  Spotify: typeof Spotify;
  onSpotifyWebPlaybackSDKReady: () => void;
}
