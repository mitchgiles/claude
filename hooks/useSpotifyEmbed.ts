'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface SpotifyIFrameAPI {
  createController(
    element: HTMLElement,
    options: { uri: string; height?: string },
    callback: (controller: SpotifyEmbedController) => void
  ): void;
}

interface SpotifyEmbedController {
  loadUri(uri: string): void;
  play(): void;
  pause(): void;
}

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: SpotifyIFrameAPI) => void;
    SpotifyIframeApi?: SpotifyIFrameAPI;
  }
}

export function useSpotifyEmbed() {
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<SpotifyEmbedController | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;

    function initController(api: SpotifyIFrameAPI) {
      if (cancelled || !containerRef.current) return;
      // Clear any previous iframe from StrictMode double-invoke
      containerRef.current.innerHTML = '';
      api.createController(
        containerRef.current,
        // Initial URI is required but won't auto-play
        { uri: 'spotify:track:4uLU6hMCjMI75M1A2tKUQC', height: '80' },
        (controller) => {
          if (!cancelled) {
            controllerRef.current = controller;
            setIsReady(true);
          }
        }
      );
    }

    if (window.SpotifyIframeApi) {
      initController(window.SpotifyIframeApi);
    } else {
      window.onSpotifyIframeApiReady = initController;
      if (!document.querySelector('script[src*="embed/iframe-api"]')) {
        const s = document.createElement('script');
        s.src = 'https://open.spotify.com/embed/iframe-api/v1';
        s.async = true;
        document.head.appendChild(s);
      }
    }

    return () => {
      cancelled = true;
      controllerRef.current = null;
      setIsReady(false);
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, []);

  const playTrack = useCallback((uri: string) => {
    controllerRef.current?.loadUri(uri);
    controllerRef.current?.play();
  }, []);

  const pause = useCallback(() => {
    controllerRef.current?.pause();
  }, []);

  return { containerRef, isReady, playTrack, pause };
}
