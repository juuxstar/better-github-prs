export const HLJS_THEMES: { id: string; label: string }[] = [
  { id: 'github-dark', label: 'GitHub Dark' },
  { id: 'github-dark-dimmed', label: 'GitHub Dimmed' },
  { id: 'dark-modern', label: 'Dark Modern' },
  { id: 'atom-one-dark', label: 'Atom One Dark' },
  { id: 'monokai', label: 'Monokai' },
  { id: 'monokai-sublime', label: 'Monokai Sublime' },
  { id: 'vs2015', label: 'VS 2015' },
  { id: 'tokyo-night-dark', label: 'Tokyo Night' },
  { id: 'nord', label: 'Nord' },
  { id: 'night-owl', label: 'Night Owl' },
  { id: 'rose-pine', label: 'Rose Pine' },
  { id: 'an-old-hope', label: 'An Old Hope' },
  { id: 'panda-syntax-dark', label: 'Panda' },
];

const themeModules: Record<string, () => Promise<{ default: string }>> = {
  'github-dark': () => import('highlight.js/styles/github-dark.min.css?raw'),
  'github-dark-dimmed': () => import('highlight.js/styles/github-dark-dimmed.min.css?raw'),
  'dark-modern': () => import('@/assets/hljs-dark-modern.css?raw'),
  'atom-one-dark': () => import('highlight.js/styles/atom-one-dark.min.css?raw'),
  'monokai': () => import('highlight.js/styles/monokai.min.css?raw'),
  'monokai-sublime': () => import('highlight.js/styles/monokai-sublime.min.css?raw'),
  'vs2015': () => import('highlight.js/styles/vs2015.min.css?raw'),
  'tokyo-night-dark': () => import('highlight.js/styles/tokyo-night-dark.min.css?raw'),
  'nord': () => import('highlight.js/styles/nord.min.css?raw'),
  'night-owl': () => import('highlight.js/styles/night-owl.min.css?raw'),
  'rose-pine': () => import('highlight.js/styles/rose-pine.min.css?raw'),
  'an-old-hope': () => import('highlight.js/styles/an-old-hope.min.css?raw'),
  'panda-syntax-dark': () => import('highlight.js/styles/panda-syntax-dark.min.css?raw'),
};

let styleEl: HTMLStyleElement | null = null;

export async function loadHljsTheme(name: string) {
  const loader = themeModules[name];
  if (!loader) return;
  const mod = await loader();
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'hljs-theme';
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = mod.default;
}
