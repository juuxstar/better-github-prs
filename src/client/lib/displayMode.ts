const PWA_DISPLAY_MODES = [ 'standalone', 'minimal-ui', 'fullscreen', 'window-controls-overlay', 'tabbed' ];

export function isPwaDisplayMode(): boolean {
	if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
		return false;
	}
	return PWA_DISPLAY_MODES.some(mode => window.matchMedia(`(display-mode: ${mode})`).matches);
}
