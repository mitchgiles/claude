import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { SpinClass, WorkoutSegment, SpotifyTrack, AudioFeatures, WorkoutIntensity } from '@/types/spotify';

const INTENSITY_VALUES: WorkoutIntensity[] = [
  'warmup', 'recovery', 'steady', 'seated-climb', 'standing-climb', 'interval', 'sprint', 'cooldown',
];

const SYSTEM_PROMPT = `You are an elite spin class instructor and music curator. Build an optimal indoor cycling workout by selecting and sequencing tracks from the provided playlist.

For each track you include, call add_segment with the appropriate workout details. Build segments in the order they should play.

WORKOUT STRUCTURE:
- Begin with 1-2 warmup songs (lower energy, gradual ramp-up)
- Build through steady-state segments
- Place 2-4 high-intensity peaks (sprints or standing climbs) in the middle third
- Insert recovery segments between intense efforts
- Finish with 1-2 cooldown songs (decreasing intensity)

INTENSITY ASSIGNMENT:
- warmup: First 1-2 tracks — any BPM, gradual engagement
- sprint: BPM >140 + energy >0.8, resistance 3-4 (fast legs, light resistance)
- standing-climb: Energy >0.7 + strong beat, resistance 8-9 (out of saddle, heavy gear)
- seated-climb: BPM 115-135 + energy 0.55-0.8, resistance 6-8 (seated power)
- interval: Danceability >0.75 + energy >0.65, resistance 5-7 (alternating bursts)
- steady: BPM 110-130 + energy 0.4-0.65, resistance 5-6 (sustainable pace)
- recovery: Energy <0.5, resistance 2-3 (active rest)
- cooldown: Final 1-2 tracks, resistance 2-3 (bring it down)

Write coaching instructions that are energetic, specific to the music feel, and motivational. Reference the beat, energy, or mood of the song.

You do NOT need to use all tracks — choose the best ones for the workout arc and target duration.`;

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'AI features not configured' }, { status: 503 });
  }

  let body: {
    tracks: Array<{ track: SpotifyTrack; features: AudioFeatures }>;
    playlistName: string;
    targetDuration: number; // seconds
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { tracks, playlistName, targetDuration } = body;
  if (!Array.isArray(tracks) || tracks.length === 0 || !playlistName) {
    return NextResponse.json({ error: 'tracks and playlistName required' }, { status: 400 });
  }

  const client = new Anthropic();

  // Compact track summary for Claude's context
  const trackList = tracks.map((t, i) => ({
    index: i,
    name: t.track.name,
    artist: t.track.artists.map((a) => a.name).join(', '),
    duration_s: Math.round(t.track.duration_ms / 1000),
    bpm: Math.round(t.features.tempo),
    energy: +t.features.energy.toFixed(2),
    danceability: +t.features.danceability.toFixed(2),
    valence: +t.features.valence.toFixed(2),
  }));

  const tools: Anthropic.Tool[] = [
    {
      name: 'add_segment',
      description:
        'Add a track as a workout segment. Call once per track you want to include, in playback order.',
      input_schema: {
        type: 'object' as const,
        properties: {
          track_index: {
            type: 'integer',
            description: `Index of the track (0–${tracks.length - 1})`,
          },
          intensity: {
            type: 'string',
            enum: INTENSITY_VALUES,
            description: 'Workout intensity for this segment',
          },
          resistance: {
            type: 'integer',
            description: 'Bike resistance 1–10. Sprints: 3–4, Climbs: 7–9, Steady: 5–6, Recovery: 2–3',
          },
          cadence: {
            type: 'integer',
            description: 'Target RPM 55–115. Sprints: 90–110, Climbs: 60–75, Steady: 75–90',
          },
          instruction: {
            type: 'string',
            description:
              'Energetic 1–2 sentence coaching cue referencing the music feel, BPM, or energy.',
          },
        },
        required: ['track_index', 'intensity', 'resistance', 'cadence', 'instruction'],
      },
    },
  ];

  const segments: WorkoutSegment[] = [];
  let messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: `Build a ${Math.round(targetDuration / 60)}-minute spin class from "${playlistName}".

Available tracks:
${JSON.stringify(trackList, null, 2)}

Call add_segment for each track you include, in playback order.`,
    },
  ];

  // Agentic loop — Claude calls add_segment to construct the workout
  for (let iter = 0; iter < 10; iter++) {
    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      system: SYSTEM_PROMPT,
      tools,
      messages,
    });

    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );

    if (response.stop_reason === 'end_turn' || toolUseBlocks.length === 0) break;

    // Append assistant turn (includes thinking + text + tool_use blocks)
    messages.push({ role: 'assistant', content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      if (toolUse.name !== 'add_segment') continue;

      const input = toolUse.input as {
        track_index: number;
        intensity: WorkoutIntensity;
        resistance: number;
        cadence: number;
        instruction: string;
      };

      const trackData = tracks[input.track_index];
      if (!trackData) {
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: `Error: track_index ${input.track_index} out of range (0–${tracks.length - 1})`,
          is_error: true,
        });
        continue;
      }

      const startTime = segments.reduce((sum, s) => sum + s.duration, 0);
      segments.push({
        track: trackData.track,
        features: trackData.features,
        intensity: input.intensity,
        instruction: input.instruction,
        resistance: Math.max(1, Math.min(10, input.resistance)),
        cadence: Math.max(55, Math.min(115, input.cadence)),
        startTime,
        duration: Math.round(trackData.track.duration_ms / 1000),
      });

      const elapsed = Math.round(segments.reduce((sum, s) => sum + s.duration, 0) / 60);
      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: `Added "${trackData.track.name}" as ${input.intensity}. Workout so far: ${elapsed} min.`,
      });
    }

    messages.push({ role: 'user', content: toolResults });
  }

  if (segments.length === 0) {
    return NextResponse.json({ error: 'AI did not generate any workout segments' }, { status: 500 });
  }

  const totalDuration = segments.reduce((sum, s) => sum + s.duration, 0);
  const avgBPM = Math.round(segments.reduce((sum, s) => sum + s.features.tempo, 0) / segments.length);
  const avgEnergy = segments.reduce((sum, s) => sum + s.features.energy, 0) / segments.length;
  const peakSegment = segments.reduce((max, s) =>
    s.features.energy > max.features.energy ? s : max,
  );
  const totalCaloriesEstimate = Math.round((totalDuration / 60) * (8 + avgEnergy * 4));

  const spinClass: SpinClass = {
    id: `spin-ai-${Date.now()}`,
    name: `AI Spin Class: ${playlistName}`,
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

  return NextResponse.json({ spinClass });
}
