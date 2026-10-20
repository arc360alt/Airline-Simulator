/** Thin-stroke line icons (24×24 viewBox), drawn with currentColor. */
const PATHS: Record<string, string> = {
  fleet: '<path d="M2.5 13.5 21 7.5c.8-.3 1.3.6.7 1.1L14 15l-1.5 6-2-.5.5-4.5-4 1.3-1.6 2.2-1.4-.4.6-3.2-2.6-1.5z"/>',
  store: '<path d="M4 7h16l-1.2 12.2a1 1 0 0 1-1 .8H6.2a1 1 0 0 1-1-.8z"/><path d="M8.5 9.5V6a3.5 3.5 0 0 1 7 0v3.5"/>',
  crew: '<circle cx="12" cy="9" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/><path d="M7.5 6.5 12 3.5l4.5 3"/>',
  routes: '<circle cx="5.5" cy="18" r="2"/><circle cx="18.5" cy="6" r="2"/><path d="M7.5 18h7a3.5 3.5 0 0 0 0-7h-5a3.5 3.5 0 0 1 0-7h7" stroke-dasharray="2.5 2.5"/>',
  airports: '<path d="M9 21V10h6v11"/><path d="M6 10h12l-1.5-4h-9z"/><path d="M12 6V3"/><path d="M4 21h16"/>',
  service: '<path d="M5 8h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M16 9.5h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M8 3.5v2M11 3v2.5M14 3.5v2"/><path d="M4 21h14"/>',
  research: '<path d="M9.5 3h5M10.5 3v6L5 19a1.3 1.3 0 0 0 1.2 2h11.6A1.3 1.3 0 0 0 19 19l-5.5-10V3"/><path d="M7.5 15h9"/>',
  finance: '<path d="M4 20V4"/><path d="M4 20h16"/><path d="M7.5 16v-4M11.5 16V8M15.5 16v-6M19 16v-9"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4 5.3 5.3"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  fuel: '<path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16"/><path d="M4 21h12"/><path d="M8 7h4"/><path d="M15 10h2a1.5 1.5 0 0 1 1.5 1.5V17a1.5 1.5 0 0 0 3 0V8l-3-3"/>',
  rp: '<circle cx="12" cy="12" r="2"/><ellipse cx="12" cy="12" rx="9" ry="3.6"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(-60 12 12)"/>',
  pause: '<path d="M8.5 5v14M15.5 5v14"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  check: '<path d="M5 12.5 10 17.5 19 7"/>',
};

export function icon(name: string, size = 18): string {
  return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name] ?? ''}</svg>`;
}

/** Icon as a DOM node, for use inside h(). */
export function iconEl(name: string, size = 18): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = 'ico-wrap';
  span.innerHTML = icon(name, size);
  return span;
}
