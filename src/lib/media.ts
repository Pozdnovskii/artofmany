export function vimeoId(url: string | undefined | null): string | null {
  if (!url) return null;
  const m = String(url).match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  return m ? m[1] : null;
}
