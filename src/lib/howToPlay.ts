/** Shared "how to play" beats — the single source of truth for both the
 * in-room HowToPlay modal and the landing-screen carousel, so the two never
 * drift out of sync. Kept short — this is a glance, not a manual. */
export interface HowToPlayStep {
  n: string;
  icon: string;
  title: string;
  body: string;
}

export const HOW_TO_PLAY_STEPS: HowToPlayStep[] = [
  {
    n: '',
    icon: '📰',
    title: 'The idea',
    body: 'Edit the post by redacting text',
  },
  {
    n: '1',
    icon: '🛎️',
    title: 'Lobby',
    body: 'Waiting room first — pick/vote on a story. Host hits Start Editing when ready.',
  },
  {
    n: '2',
    icon: '✏️',
    title: 'Round',
    body: 'Everyone redacts their own copy before the timer runs out.',
  },
  {
    n: '3',
    icon: '📢',
    title: 'Reveal',
    body: 'Redactions are shown one at a time, synced for everyone.',
  },
  {
    n: '4',
    icon: '🗳️',
    title: 'Voting',
    body: "Optional — vote for your favorite. Counts stay hidden until it closes.",
  },
];
