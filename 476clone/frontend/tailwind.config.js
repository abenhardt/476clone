/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      // ─── Typography ───────────────────────────────────────────────
      fontFamily: {
        headline: ['"Crimson Pro"', 'Georgia', 'serif'],
        body: ['Outfit', 'system-ui', '-apple-system', 'sans-serif'],
      },

      // ─── Design Token Colors ──────────────────────────────────────
      // All values reference CSS custom properties from design-tokens.css
      colors: {
        // Semantic surface tokens
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: 'var(--card)',
        'card-foreground': 'var(--card-foreground)',
        popover: 'var(--popover)',
        'popover-foreground': 'var(--popover-foreground)',
        primary: 'var(--primary)',
        'primary-foreground': 'var(--primary-foreground)',
        secondary: 'var(--secondary)',
        'secondary-foreground': 'var(--secondary-foreground)',
        muted: 'var(--muted)',
        'muted-foreground': 'var(--muted-foreground)',
        accent: 'var(--accent)',
        'accent-foreground': 'var(--accent-foreground)',
        destructive: 'var(--destructive)',
        'destructive-foreground': 'var(--destructive-foreground)',
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',

        // Luminous accent palette
        'ember-orange': 'var(--ember-orange)',
        'warm-amber': 'var(--warm-amber)',
        'forest-green': 'var(--forest-green)',
        'night-sky-blue': 'var(--night-sky-blue)',

        // Overlay system (backgrounds)
        'overlay-primary': 'var(--overlay-primary)',
        'overlay-secondary': 'var(--overlay-secondary)',
        'overlay-light': 'var(--overlay-light)',
        'overlay-medium': 'var(--overlay-medium)',
        'overlay-subtle': 'var(--overlay-subtle)',
        'overlay-nav': 'var(--overlay-nav)',
        'overlay-nav-subtle': 'var(--overlay-nav-subtle)',

        // Glass surface system
        'glass-overlay': 'var(--glass-overlay)',
        'glass-strong': 'var(--glass-strong)',
        'glass-medium': 'var(--glass-medium)',
        'glass-dark-strong': 'var(--glass-dark-strong)',
        'glass-dark-medium': 'var(--glass-dark-medium)',
        'glass-icon-bg': 'var(--glass-icon-bg)',
        'glass-mission-bg': 'var(--glass-mission-bg)',
        'glass-footer-dark': 'var(--glass-footer-dark)',
        'glass-footer-light': 'var(--glass-footer-light)',

        // Text overlay tokens
        'text-overlay-dark': 'var(--text-overlay-dark)',
        'text-overlay-light': 'var(--text-overlay-light)',

        // Border tokens
        'border-ember': 'var(--border-ember)',
        'border-glass': 'var(--border-glass)',
        'button-border-dark': 'var(--button-border-dark)',
        'button-border-light': 'var(--button-border-light)',

        // Navigation
        'nav-text': 'var(--nav-text)',
        'nav-text-active': 'var(--nav-text-active)',
      },

      // ─── Elevation / Shadow System ────────────────────────────────
      boxShadow: {
        'ember-primary': 'var(--shadow-ember-primary)',
        'ember-secondary': 'var(--shadow-ember-secondary)',
        'amber-glow': 'var(--shadow-amber-glow)',
        'hero-panel': 'var(--shadow-hero-panel)',
        card: 'var(--shadow-card)',
        'card-prominent': 'var(--shadow-card-prominent)',
        'card-subtle': 'var(--shadow-card-subtle)',
        'card-glass': 'var(--shadow-card-glass)',
        'light-button-primary': 'var(--shadow-light-button-primary)',
        'light-button-secondary': 'var(--shadow-light-button-secondary)',
        'light-icon': 'var(--shadow-light-icon)',
      },

      // ─── Backdrop Blur ────────────────────────────────────────────
      backdropBlur: {
        glass: '16px', // Buttons (primary), language dropdown
      },

      // ─── Transition Durations ─────────────────────────────────────
      transitionDuration: {
        button: '500ms', // Button hover (spec §8.6)
        hover: '300ms',  // Micro interactions / input focus
      },
    },
  },
  plugins: [],
};
