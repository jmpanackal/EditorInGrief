/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // --- surfaces (Discord-ish comfortable dark, warm-neutral) -------
        ink: '#0f1116', // app background
        panel: '#181b22', // primary card surface
        panel2: '#212530', // inset / secondary surface
        panel3: '#2b303c', // raised control / hover
        hair: 'rgba(255,255,255,0.08)', // hairline dividers

        // --- brand + accents --------------------------------------------
        grief: '#f43f5e', // primary (refined "Grief" rose)
        griefdim: '#e11d48',
        grieflite: '#fb7185',
        blurple: '#6366f1', // secondary playful accent
        blurpledim: '#4f46e5',
        accent: '#38bdf8', // info / progress
        mint: '#34d399', // presence / success
        gold: '#fbbf24', // winners / quick-fire
      },
      fontFamily: {
        display: ['Fredoka', 'ui-rounded', 'Segoe UI', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        xl2: '1.125rem',
        '4xl': '2rem',
      },
      boxShadow: {
        card: '0 10px 30px -12px rgba(0,0,0,0.55)',
        'glow-grief': '0 8px 24px -6px rgba(244,63,94,0.45)',
        'glow-blurple': '0 8px 24px -6px rgba(99,102,241,0.45)',
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
        floaty: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
      },
      animation: {
        pop: 'pop 0.18s ease-out',
        'fade-up': 'fade-up 0.28s ease-out',
        floaty: 'floaty 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
