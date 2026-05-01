/**
 * Lightweight notification chime synthesised with Web Audio.
 * No file dependency, works everywhere, respects browser autoplay
 * policies (must be invoked from a user gesture for the first play).
 *
 * Stored preference: `chime.enabled` in localStorage (default: enabled).
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (ctx) return ctx;
  const Ctor =
    (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    ctx = null;
  }
  return ctx;
}

export function isChimeEnabled(): boolean {
  if (typeof localStorage === 'undefined') return true;
  return localStorage.getItem('chime.enabled') !== 'false';
}

export function setChimeEnabled(enabled: boolean): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem('chime.enabled', enabled ? 'true' : 'false');
}

interface ChimeOptions {
  /** Frequencies (Hz) played in sequence. */
  notes?: number[];
  /** Per-note duration in seconds. */
  noteDuration?: number;
  /** Gap between notes in seconds. */
  gap?: number;
  /** Peak gain (0..1). */
  volume?: number;
  /** Force play even if user disabled. */
  force?: boolean;
}

/**
 * Play a short pleasant 2-tone chime.
 * Defaults sound like a soft "ding-dong" used for queue announcements.
 */
export function playChime(opts: ChimeOptions = {}): void {
  if (!opts.force && !isChimeEnabled()) return;
  const audio = getCtx();
  if (!audio) return;

  // Some browsers suspend the context until a gesture occurs.
  if (audio.state === 'suspended') {
    audio.resume().catch(() => {});
  }

  const notes = opts.notes ?? [880, 660];
  const noteDuration = opts.noteDuration ?? 0.18;
  const gap = opts.gap ?? 0.05;
  const volume = opts.volume ?? 0.25;

  let t = audio.currentTime;
  notes.forEach((freq) => {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + noteDuration);
    osc.connect(gain).connect(audio.destination);
    osc.start(t);
    osc.stop(t + noteDuration + 0.02);
    t += noteDuration + gap;
  });
}

/** Louder, more attention-grabbing variant for "patient called" events. */
export function playCallChime(): void {
  playChime({ notes: [988, 740, 988], noteDuration: 0.16, volume: 0.3 });
}
