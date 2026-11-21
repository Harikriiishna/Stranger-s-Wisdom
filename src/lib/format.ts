export const QUESTION_CATEGORIES = [
  'Life',
  'Love and Relationships',
  'Friendship',
  'Career',
  'College',
  'Family',
  'Mental Wellbeing',
  'Personal Growth',
  'Decisions',
  'Regrets',
  'Confidence',
  'Money',
  'Experiences',
  'Other',
] as const;

export const EXPLORE_CHIPS = [
  'All',
  'Life',
  'Love',
  'Friendship',
  'Career',
  'College',
  'Growth',
  'Decisions',
] as const;

export const QUESTION_TYPES = [
  'I Need Advice',
  'I Need Perspective',
  'Has Anyone Experienced This?',
  'What Would You Do?',
  'I Just Need to Say This',
  'Something I Learned',
] as const;

export const ANSWER_TYPES = [
  'I Experienced This',
  'My Advice',
  'Another Perspective',
  'What I Learned',
] as const;

export const REACTION_TYPES = [
  { id: 'this_helped', label: 'This Helped Me' },
  { id: 'i_understand', label: 'I Understand' },
  { id: 'i_needed_this', label: 'I Needed This' },
  { id: 'thank_you', label: 'Thank You' },
  { id: 'different_perspective', label: 'Different Perspective' },
] as const;

export const REPORT_REASONS = [
  'Harassment',
  'Hate or discrimination',
  'Threats',
  'Spam',
  'Inappropriate content',
  'Dangerous advice',
  'Self-harm concerns',
  'Other',
] as const;

export function formatTimeAgo(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.max(1, Math.floor(diffMs / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning.';
  if (hour < 17) return 'Good afternoon.';
  return 'Good evening.';
}

export function formatStatusLabel(status: string): string {
  switch (status) {
    case 'open':
      return 'Open';
    case 'answered':
      return 'Answered';
    case 'archived':
      return 'Archived';
    case 'waiting':
      return 'Waiting';
    case 'answer_received':
      return 'Answer received';
    case 'delivered':
      return 'Delivered';
    case 'closed':
      return 'Closed';
    default:
      return status;
  }
}
