'use client';

import { useEffect, useRef, useState } from 'react';

function isMobileBrowser() {
  if (typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

function loadSdk(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.Spotify) return Promise.resolve();
  return new Promise((resolve) => {
    window.onSpotifyWebPlaybackSDKReady = resolve;
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    document.head.appendChild(script);
  });
}

export function useSpotifyPlayer() {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const playerRef = useRef<Spotify.Player | null>(null);

  useEffect(() => {
    // Mobile browsers don't support the Web Playback SDK.
    // Mark as ready immediately so the workout page can use Connect mode.
    if (isMobileBrowser()) {
      setIsMobile(true);
      setIsReady(true);
      return;
    }

    let cancelled = false;

    async function init() {
      await loadSdk();
      if (cancelled) return;

      const player = new window.Spotify.Player({
        name: 'Spin Class',
        getOAuthToken: (cb) => {
          fetch('/api/spotify/token')
            .then((r) => r.json())
            .then((d) => cb(d.token))
            .catch(() => {});
        },
        volume: 0.8,
      });

      player.addListener('ready', ({ device_id }) => {
        if (!cancelled) { setDeviceId(device_id); setIsReady(true); }
      });
      player.addListener('not_ready', () => setIsReady(false));
      player.addListener('initialization_error', ({ message }) => setError(message));
      player.addListener('authentication_error', ({ message }) => setError(message));
      player.addListener('account_error', () =>
        setError('Spotify Premium required for in-browser playback')
      );

      const connected = await player.connect();
      if (!connected && !cancelled) setError('Failed to connect Spotify player');
      playerRef.current = player;
    }

    init().catch((e) => setError(String(e)));

    return () => {
      cancelled = true;
      playerRef.current?.disconnect();
    };
  }, []);

  return { deviceId, isReady, error, isMobile };
}
