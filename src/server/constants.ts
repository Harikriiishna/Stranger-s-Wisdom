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

export const CRISIS_RESOURCES = {
  notice:
    'Stranger’s Wisdom is a peer reflection space and is not a substitute for professional medical, mental-health, legal, or emergency support. If you or someone else may be in immediate danger, please reach out right away.',
  hotlines: [
    {
      name: '988 Suicide & Crisis Lifeline (US & Canada)',
      contact: 'Call or text 988 (24/7, free, confidential)',
    },
    {
      name: 'Crisis Text Line',
      contact: 'Text HOME to 741741',
    },
    {
      name: 'International Emergency & Helplines',
      contact: 'Contact your local emergency services or visit findahelpline.com',
    },
  ],
};
