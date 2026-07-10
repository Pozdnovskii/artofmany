/** Extract the numeric Vimeo id from a Vimeo URL. */
export function vimeoId(url: string | undefined | null): string | null {
  if (!url) return null;
  const m = String(url).match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  return m ? m[1] : null;
}

/** Extract the 11-char YouTube id from any common YouTube URL form. */
export function youTubeId(url: string | undefined | null): string | null {
  if (!url) return null;
  const s = String(url);
  const m =
    s.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([\w-]{11})/i) ||
    s.match(/[?&]v=([\w-]{11})/i);
  return m ? m[1] : null;
}
