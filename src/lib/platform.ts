export const isMac =
  typeof window !== 'undefined' &&
  /Mac|iPod|iPhone|iPad/.test(navigator.userAgent || navigator.platform);

export const modKey = isMac ? 'Cmd' : 'Ctrl';
export const modSymbol = isMac ? '⌘' : 'Ctrl';

export const altKey = isMac ? 'Option' : 'Alt';
export const altSymbol = isMac ? '⌥' : 'Alt';

export function formatShortcut(text: string): string {
  return text
    .replace(/Ctrl\/Cmd/g, modKey)
    .replace(/Alt\/Option/g, altKey)
    .replace(/Alt\/Opt/g, altKey);
}

