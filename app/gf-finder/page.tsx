'use client';

import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';

// ── Types ────────────────────────────────────────────────────────────────────

interface ProgressEvent {
  step?: number;
  status?: string;
  store?: string;
  date?: string;
  items?: string[];
  progress?: number;
  total?: number;
  error?: string;
  done?: boolean;
  message?: string;
  excel_b64?: string;
  filename?: string;
  summary?: {
    items: number;
    total_paid: number;
    total_lowest: number;
    savings: number;
    savings_pct: number;
  };
}

type Phase = 'idle' | 'uploading' | 'processing' | 'done' | 'error';

// ── Helpers ──────────────────────────────────────────────────────────────────

function b64ToBlob(b64: string, mime: string): Blob {
  const bytes = atob(b64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function triggerDownload(b64: string, filename: string) {
  const url = URL.createObjectURL(
    b64ToBlob(b64, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const API_URL = process.env.NEXT_PUBLIC_GF_API_URL ?? 'http://localhost:8000';

const STEP_LABELS: Record<number, string> = {
  1: 'Reading receipt',
  2: 'Searching Canadian prices',
  3: 'Building Excel report',
};

// ── Component ────────────────────────────────────────────────────────────────

export default function GFFinderPage() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState<{ n: number; total: number } | null>(null);
  const [summary, setSummary] = useState<ProgressEvent['summary'] | null>(null);
  const [excelPayload, setExcelPayload] = useState<{ b64: string; filename: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [...prev, msg]);
    setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, []);

  const reset = () => {
    setPhase('idle');
    setPreview(null);
    setFileName('');
    setLogs([]);
    setCurrentStep(0);
    setProgress(null);
    setSummary(null);
    setExcelPayload(null);
    setErrorMsg('');
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please upload an image file (JPEG, PNG, WebP, GIF).');
      setPhase('error');
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
    uploadAndStream(file);
  };

  const uploadAndStream = async (file: File) => {
    setPhase('uploading');
    setLogs([]);
    addLog('Uploading receipt…');

    const form = new FormData();
    form.append('image', file);

    let response: Response;
    try {
      response = await fetch(`${API_URL}/analyze`, { method: 'POST', body: form });
    } catch {
      setErrorMsg('Could not reach the analysis server. Is it running?');
      setPhase('error');
      return;
    }

    if (!response.ok) {
      const detail = await response.text();
      setErrorMsg(detail || `Server error ${response.status}`);
      setPhase('error');
      return;
    }

    setPhase('processing');
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (!raw) continue;

        let evt: ProgressEvent;
        try {
          evt = JSON.parse(raw);
        } catch {
          continue;
        }

        if (evt.error) {
          setErrorMsg(evt.error);
          setPhase('error');
          return;
        }

        if (evt.step) {
          setCurrentStep(evt.step);
          if (evt.status) addLog(evt.status);
          if (evt.store) addLog(`Store: ${evt.store}  |  Date: ${evt.date}`);
          if (evt.items?.length) addLog(`Items: ${evt.items.join(', ')}`);
          if (evt.progress !== undefined && evt.total !== undefined) {
            setProgress({ n: evt.progress, total: evt.total });
          }
        }

        if (evt.done) {
          if (evt.message) {
            addLog(evt.message);
            setPhase('done');
            return;
          }
          setSummary(evt.summary!);
          setExcelPayload({ b64: evt.excel_b64!, filename: evt.filename! });
          addLog('Excel report ready!');
          setPhase('done');
        }
      }
    }
  };

  // ── Drag & Drop ──────────────────────────────────────────────────────────────
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center gap-4">
        <Link href="/" className="text-gray-500 hover:text-gray-300 transition-colors text-sm">
          ← SpinSync
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-green-600 flex items-center justify-center shadow-md shadow-green-900/40">
            <span className="text-lg">🌾</span>
          </div>
          <div>
            <h1 className="text-white font-bold text-base leading-tight">GF Price Finder</h1>
            <p className="text-green-400 text-xs">Canada · Gluten-Free Savings</p>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-start px-4 py-10 gap-8 max-w-2xl mx-auto w-full">
        {/* Intro */}
        {phase === 'idle' && (
          <p className="text-gray-400 text-center text-sm max-w-md">
            Snap a photo of your grocery receipt. The app finds every gluten-free item and scours
            Canadian retailers for the lowest comparable price — then hands you an Excel spreadsheet.
          </p>
        )}

        {/* Drop zone (hidden when processing/done) */}
        {(phase === 'idle' || phase === 'error') && (
          <div
            className={`w-full rounded-2xl border-2 border-dashed transition-colors cursor-pointer
              ${dragOver ? 'border-green-400 bg-green-950/30' : 'border-gray-700 hover:border-gray-500 bg-gray-900/40'}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            <div className="flex flex-col items-center gap-3 py-14 px-6">
              <span className="text-5xl select-none">📷</span>
              <p className="text-gray-300 font-medium">Drop receipt photo here</p>
              <p className="text-gray-500 text-sm">or click to browse · JPEG, PNG, WebP, GIF</p>
              {phase === 'error' && (
                <p className="text-red-400 text-sm mt-2 text-center">{errorMsg}</p>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
            />
          </div>
        )}

        {/* Processing / Done card */}
        {(phase === 'uploading' || phase === 'processing' || phase === 'done') && (
          <div className="w-full rounded-2xl bg-gray-900 border border-gray-800 overflow-hidden">
            {/* Image preview strip */}
            {preview && (
              <div className="relative h-40 bg-gray-800 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Receipt" className="w-full h-full object-contain" />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 to-transparent" />
                <p className="absolute bottom-2 left-4 text-gray-300 text-xs truncate max-w-xs">
                  {fileName}
                </p>
              </div>
            )}

            {/* Steps */}
            <div className="px-5 pt-5 pb-2 flex gap-3">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                      ${currentStep > s ? 'bg-green-600 text-white' :
                        currentStep === s ? 'bg-green-500 text-white animate-pulse' :
                        'bg-gray-700 text-gray-500'}`}
                  >
                    {currentStep > s ? '✓' : s}
                  </div>
                  <span className="text-gray-500 text-xs text-center leading-tight hidden sm:block">
                    {STEP_LABELS[s]}
                  </span>
                </div>
              ))}
            </div>

            {/* Progress bar (step 2) */}
            {currentStep === 2 && progress && (
              <div className="px-5 py-2">
                <div className="h-1.5 rounded-full bg-gray-700 overflow-hidden">
                  <div
                    className="h-full bg-green-500 transition-all duration-300"
                    style={{ width: `${(progress.n / progress.total) * 100}%` }}
                  />
                </div>
                <p className="text-gray-500 text-xs mt-1">
                  {progress.n} / {progress.total} items
                </p>
              </div>
            )}

            {/* Log */}
            <div className="mx-5 my-3 rounded-lg bg-gray-950 border border-gray-800 p-3 h-32 overflow-y-auto font-mono text-xs text-gray-400 space-y-0.5">
              {logs.map((l, i) => (
                <div key={i} className="leading-relaxed">
                  <span className="text-green-600 select-none">› </span>{l}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>

            {/* Summary + Download */}
            {phase === 'done' && summary && excelPayload && (
              <div className="px-5 pb-5 space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Items', value: summary.items },
                    { label: 'You paid', value: `$${summary.total_paid.toFixed(2)}` },
                    { label: 'Best price', value: `$${summary.total_lowest.toFixed(2)}` },
                    { label: 'Savings', value: `$${summary.savings.toFixed(2)} (${summary.savings_pct}%)`, highlight: true },
                  ].map(({ label, value, highlight }) => (
                    <div key={label} className="rounded-xl bg-gray-800 p-3 text-center">
                      <p className="text-gray-400 text-xs mb-1">{label}</p>
                      <p className={`font-bold text-sm ${highlight ? 'text-green-400' : 'text-white'}`}>
                        {value}
                      </p>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => triggerDownload(excelPayload.b64, excelPayload.filename)}
                  className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-500 active:bg-green-700 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <span>⬇</span> Download Excel Report
                </button>

                <button
                  onClick={reset}
                  className="w-full py-2.5 rounded-xl border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-gray-200 text-sm transition-colors"
                >
                  Scan another receipt
                </button>
              </div>
            )}

            {phase === 'done' && !excelPayload && (
              <div className="px-5 pb-5">
                <button
                  onClick={reset}
                  className="w-full py-2.5 rounded-xl border border-gray-700 text-gray-400 text-sm hover:border-gray-500 hover:text-gray-200 transition-colors"
                >
                  Try another receipt
                </button>
              </div>
            )}
          </div>
        )}

        {/* How it works */}
        {phase === 'idle' && (
          <div className="w-full grid sm:grid-cols-3 gap-4 text-center">
            {[
              { emoji: '📄', title: 'Scan Receipt', body: 'Claude Vision reads every item — produce, packaged goods, beverages.' },
              { emoji: '🍁', title: 'Search Canada', body: 'Live web search across Walmart, Loblaws, Costco, Amazon.ca & more.' },
              { emoji: '📊', title: 'Excel Report', body: '3-tab workbook: savings summary, store comparisons, and search notes.' },
            ].map(({ emoji, title, body }) => (
              <div key={title} className="rounded-xl bg-gray-900 border border-gray-800 p-5">
                <div className="text-3xl mb-2">{emoji}</div>
                <h3 className="text-white font-semibold text-sm mb-1">{title}</h3>
                <p className="text-gray-500 text-xs leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
