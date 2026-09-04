/**
 * Topic → plausible job titles (for LinkedIn headlines).
 * Personal topics allow a broad "any professional" set.
 */
import { pick } from './pools.mjs';

const CORPORATE = [
  'Product Manager', 'Software Engineer', 'Marketing Specialist', 'Financial Analyst',
  'Customer Success Manager', 'Project Coordinator', 'Executive Assistant', 'Sales Director',
  'Data Analyst', 'HR Business Partner', 'UX Designer', 'Content Strategist', 'Recruiter',
  'IT Support Specialist', 'Brand Manager', 'Senior Consultant', 'Team Lead', 'Operations Lead',
  'VP of Operations', 'Director of People', 'Founder & CEO', 'Girlboss | Founder',
];

const CLINICAL = [
  'Registered Nurse', 'Nurse Educator', 'Physical Therapist', 'EMT', 'Pharmacist',
  'Clinical Social Worker', 'Dental Hygienist',
];

const EDUCATORS = [
  'High School Teacher', 'Adjunct Professor', 'Librarian', 'Nurse Educator',
];

const TRADES = [
  'Construction Superintendent', 'Warehouse Associate', 'Civil Engineer',
  'Logistics Supervisor', 'Store Manager',
];

const SMALL_BIZ = [
  'Restaurant Owner', 'Real Estate Agent', 'Personal Trainer', 'Freelance Designer',
  'Independent Contractor', 'Barista & Shift Lead', 'Managing Partner', 'Principal Consultant',
];

const FINANCE = [
  'Senior Accountant', 'Financial Analyst', 'Loan Officer', 'Paralegal',
];

/** Topics that are personal life — any job is fine. */
const PERSONAL_TOPICS = new Set([
  'parenting', 'family', 'pets', 'fitness', 'food', 'travel', 'sports',
  'housing', 'commute', 'gratitude', 'volunteering', 'community',
]);

export const TOPIC_TITLES = {
  workplace: CORPORATE,
  promotion: CORPORATE,
  career_advice: CORPORATE,
  remote_work: CORPORATE,
  ai_at_work: [...CORPORATE.filter((t) => /Engineer|Product|Data|IT|UX|Founder|CEO|Consultant/i.test(t)), 'Software Engineer', 'Product Manager'],
  customer_experience: ['Customer Success Manager', 'Store Manager', 'Sales Director', 'Brand Manager', 'Restaurant Owner'],
  startup: ['Founder & CEO', 'Girlboss | Founder', 'Product Manager', 'Software Engineer', 'Managing Partner'],
  small_business: SMALL_BIZ,
  personal_finance: [...FINANCE, 'Product Manager', 'High School Teacher', 'Registered Nurse', 'Freelance Designer'],
  education: EDUCATORS,
  teaching: EDUCATORS,
  healthcare: CLINICAL,
  trades: TRADES,
  parenting: [...CORPORATE, ...CLINICAL, ...EDUCATORS, ...SMALL_BIZ],
  family: [...CORPORATE, ...CLINICAL, ...EDUCATORS],
  pets: [...CORPORATE, ...CLINICAL, ...SMALL_BIZ],
  fitness: ['Personal Trainer', ...CORPORATE.slice(0, 8), 'Physical Therapist'],
  food: ['Restaurant Owner', 'Barista & Shift Lead', ...CORPORATE.slice(0, 6)],
  travel: CORPORATE,
  sports: [...CORPORATE.slice(0, 10), 'High School Teacher', 'Personal Trainer'],
  community: [...CORPORATE, ...EDUCATORS, 'Librarian'],
  housing: [...FINANCE, 'Real Estate Agent', ...CORPORATE.slice(0, 8)],
  commute: CORPORATE,
  gratitude: [...CORPORATE, ...CLINICAL, ...EDUCATORS],
  volunteering: [...CORPORATE, ...CLINICAL, ...EDUCATORS],
};

export function titlesForTopic(topic) {
  if (PERSONAL_TOPICS.has(topic)) {
    return TOPIC_TITLES[topic] || [...CORPORATE, ...CLINICAL, ...EDUCATORS, ...SMALL_BIZ];
  }
  return TOPIC_TITLES[topic] || CORPORATE;
}

export function pickTitleForTopic(rng, topic) {
  return pick(rng, titlesForTopic(topic));
}

/** Structures that stay coherent on LinkedIn/Facebook/Twitter. */
export const PROFESSIONAL_STRUCTURES = [
  'short_update', 'story_lesson', 'opinion_support', 'before_after', 'two_voices',
  'email_forward', 'metrics_then_human', 'quote_reply', 'short_list', 'howto_steps',
];

export const PERSONAL_STRUCTURES = [
  'short_update', 'story_lesson', 'before_after', 'two_voices',
  'timeline_week', 'open_letter', 'opinion_support', 'howto_steps',
];

export const YOUTUBE_STRUCTURES = [
  'yt_timestamp', 'yt_thanks', 'yt_disagree', 'yt_story', 'yt_question', 'yt_list_tips',
];

export const NEWS_STRUCTURES = ['news_lede', 'short_update', 'story_lesson'];

export function structuresForPlatform(platform, topic, bucket) {
  let pool;
  if (platform === 'youtube') pool = YOUTUBE_STRUCTURES.slice();
  else if (platform === 'news') pool = NEWS_STRUCTURES.slice();
  else if (PERSONAL_TOPICS.has(topic)) pool = PERSONAL_STRUCTURES.slice();
  else pool = PROFESSIONAL_STRUCTURES.slice();

  if (bucket === 'short') {
    pool = pool.filter((s) => !['howto_steps', 'timeline_week', 'yt_story', 'email_forward', 'metrics_then_human'].includes(s));
    if (!pool.length) pool = ['short_update', 'yt_thanks', 'yt_timestamp'];
  }
  // Long posts: paragraphs, not lists
  if (bucket === 'long') {
    pool = pool.filter((s) => !['short_list', 'howto_steps', 'yt_list_tips'].includes(s));
    if (platform === 'youtube') pool = ['yt_story', 'yt_disagree', 'yt_question', 'yt_timestamp'];
    if (!pool.length) pool = ['story_lesson', 'before_after', 'two_voices'];
  }
  // Mid: allow at most occasional list — keep lists minority
  if (bucket === 'mid') {
    // keep lists but they'll compete with many prose forms
  }
  return pool;
}
