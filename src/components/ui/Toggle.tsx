/**
 * Toggle — an ink switch that fits the newspaper theme (replaces native
 * checkboxes). Off = kraft track; On = inked/red track with a paper knob.
 * Accessible (role=switch, keyboard-toggle) and touch-friendly.
 */
interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  /** Accent when on. */
  tone?: 'grief' | 'ink';
  'aria-label'?: string;
}

const TONE: Record<NonNullable<ToggleProps['tone']>, string> = {
  grief: 'bg-grief',
  ink: 'bg-ink',
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
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 border-ink transition-colors duration-200
        disabled:opacity-40 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-grief/50
        ${checked ? TONE[tone] : 'bg-paper2'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-papercard border-2 border-ink transition-transform duration-200
          ${checked ? 'translate-x-6' : 'translate-x-0.5'}`}
      />
    </button>
  );
}
