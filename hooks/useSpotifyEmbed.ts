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
  addListener(event: 'playback_update', cb: (e: { data: { isPaused: boolean; position: number } }) => void): void;
  addListener(event: string, cb: (e: unknown) => void): void;
}

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: SpotifyIFrameAPI) => void;
  }
}

// Module-level cache so StrictMode's double-invoke doesn't lose the API
// reference (the SDK only calls onSpotifyIframeApiReady once).
let cachedApi: SpotifyIFrameAPI | null = null;

export function useSpotifyEmbed() {
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<SpotifyEmbedController | null>(null);
  const pendingUriRef = useRef<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;

    function initController(api: SpotifyIFrameAPI) {
      cachedApi = api;
      if (cancelled || !containerRef.current) return;
      containerRef.current.innerHTML = '';
      api.createController(
        containerRef.current,
        { uri: 'spotify:track:4uLU6hMCjMI75M1A2tKUQC', height: '152' },
        (controller) => {
          if (cancelled) return;
          controllerRef.current = controller;

          // Play any track that was queued before the controller was ready
          controller.addListener('ready' as string, () => {
            if (!cancelled) setIsReady(true);
            if (pendingUriRef.current) {
              controller.loadUri(pendingUriRef.current);
              controller.play();
              pendingUriRef.current = null;
            }
          });

          setIsReady(true);
        }
      );
    }

    if (cachedApi) {
      initController(cachedApi);
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
    const ctrl = controllerRef.current;
    if (!ctrl) {
      // Controller not ready yet — queue the URI
      pendingUriRef.current = uri;
      return;
    }
    ctrl.loadUri(uri);
    // Small delay to let the iframe buffer the track before playing
    setTimeout(() => ctrl.play(), 300);
  }, []);

  const pause = useCallback(() => {
    controllerRef.current?.pause();
  }, []);

  return { containerRef, isReady, playTrack, pause };
}
