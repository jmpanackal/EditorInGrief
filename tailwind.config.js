/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // --- newsprint paper surfaces ------------------------------------
        paper: '#f4f1e9', // app background (warm off-white newsprint)
        paper2: '#e8e2d3', // inset / secondary surface (kraft)
        paper3: '#ddd5c2', // pressed / hover kraft
        papercard: '#faf8f1', // clipping / card surface (brighter stock)
        // --- ink + accent ------------------------------------------------
        ink: '#1a1a1a', // near-black body ink
        ink2: '#4a4640', // secondary ink (muted)
        ink3: '#6b655c', // tertiary / captions
        grief: '#c81e1e', // stop-press red (primary action / highlight)
        griefdark: '#9e1515',
        grieflite: '#e04b3a',
        gold: '#a9791f', // muted award gold (winner marks on paper)
      },
      fontFamily: {
        // Masthead + headlines (elegant high-contrast serif).
        display: ['"Playfair Display"', 'Georgia', 'Times New Roman', 'serif'],
        // Kickers, labels, buttons, body — sturdy legible slab.
        slab: ['"Zilla Slab"', 'Rockwell', 'Georgia', 'serif'],
        sans: ['"Zilla Slab"', 'Rockwell', 'Georgia', 'serif'],
      },
      borderRadius: {
        xl2: '1.125rem',
      },
      boxShadow: {
        // Print/paste-up feel: crisp offset rather than soft glow.
        clip: '3px 4px 0 rgba(26,26,26,0.14)',
        press: '2px 3px 0 rgba(26,26,26,0.85)',
        'press-red': '2px 3px 0 rgba(158,21,21,0.9)',
      },
      keyframes: {
        pop: {
          '0%': { transform: 'scale(0.96)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'fade-up': {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'stamp-in': {
          '0%': { transform: 'rotate(-8deg) scale(1.6)', opacity: '0' },
          '60%': { transform: 'rotate(-8deg) scale(0.92)', opacity: '1' },
          '100%': { transform: 'rotate(-8deg) scale(1)', opacity: '1' },
        },
      },
      animation: {
        pop: 'pop 0.18s ease-out',
        'fade-up': 'fade-up 0.28s ease-out',
        'stamp-in': 'stamp-in 0.32s cubic-bezier(0.2, 0.9, 0.3, 1.2)',
      },
    },
  },
  plugins: [],
};
