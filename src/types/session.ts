export type SessionType = 'quick_prep' | 'full_mock' | 'premium_audio' | 'pro';

export interface SessionConfig {
  type: SessionType;
  name: string;
  price: string;
  description: string;
  icon: string;
  features: string[];
  badgeVariant: 'quick' | 'mock' | 'audio' | 'pro';
}

export const SESSION_CONFIGS: Record<SessionType, SessionConfig> = {
  quick_prep: {
    type: 'quick_prep',
    name: 'Quick Prep',
    price: '$12',
    description: 'AI-generated comprehensive interview prep packet with tailored questions, answers, and company insights.',
    icon: '⚡',
    features: [
      'Personalized prep packet',
      'Top interview questions',
      'Company research summary',
      'Key talking points',
    ],
    badgeVariant: 'quick',
  },
  full_mock: {
    type: 'full_mock',
    name: 'Full Mock Interview',
    price: '$29',
    description: 'Interactive 10-question mock interview with real-time AI feedback and detailed performance analysis.',
    icon: '🎯',
    features: [
      '10 tailored questions',
      'Real-time feedback',
      'Performance scoring',
      'Improvement suggestions',
    ],
    badgeVariant: 'mock',
  },
  premium_audio: {
    type: 'premium_audio',
    name: 'Premium Audio Mock',
    price: '$49',
    description: 'Voice-based interview experience with our AI interviewer. Practice speaking your answers naturally.',
    icon: '🎙️',
    features: [
      'Voice-to-voice interaction',
      'Natural conversation flow',
      'Speech pattern analysis',
      'Confidence scoring',
    ],
    badgeVariant: 'audio',
  },
  pro: {
    type: 'pro',
    name: 'Pro Subscription',
    price: '$79/month',
    description: 'Unlimited access to all session types. Perfect for active job seekers.',
    icon: '👑',
    features: [
      'Unlimited Quick Preps',
      'Unlimited Mock Interviews',
      'Unlimited Audio Sessions',
      'Priority support',
    ],
    badgeVariant: 'pro',
  },
};

export interface DocumentInputs {
  resume: string;
  jobDescription: string;
  companyUrl: string;
}

export interface SessionState {
  sessionType: SessionType | null;
  userEmail: string | null;
  documents: DocumentInputs;
  isSessionStarted: boolean;
  isLoading: boolean;
}
