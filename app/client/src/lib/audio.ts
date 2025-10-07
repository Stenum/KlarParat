let audioContext: AudioContext | null = null;

export async function ensureAudioContext() {
  if (audioContext) return audioContext;
  const ctx = new AudioContext();
  await ctx.resume();
  audioContext = ctx;
  return ctx;
}

export async function playAudioFromUrl(url: string) {
  const ctx = await ensureAudioContext();
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = await ctx.decodeAudioData(arrayBuffer);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start(0);
}
