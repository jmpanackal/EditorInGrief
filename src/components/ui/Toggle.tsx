/**
 * Toggle — a design-system switch that replaces the out-of-place native
 * checkboxes. Accessible (role=switch, keyboard-toggle) and touch-friendly.
 */
interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  /** Accent color when on. */
  tone?: 'grief' | 'blurple' | 'gold';
  'aria-label'?: string;
}

const TONE: Record<NonNullable<ToggleProps['tone']>, string> = {
  grief: 'bg-grief shadow-glow-grief',
  blurple: 'bg-blurple shadow-glow-blurple',
  gold: 'bg-gold',
};

export function Toggle({ checked, onChange, disabled, tone = 'grief', ...rest }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={rest['aria-label']}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors duration-200
        disabled:opacity-40 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40
        ${checked ? `${TONE[tone]} border-transparent` : 'bg-panel3 border-white/10'}`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200
          ${checked ? 'translate-x-6' : 'translate-x-1'}`}
      />
    </button>
  );
}
