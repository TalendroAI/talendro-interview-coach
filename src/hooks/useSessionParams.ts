import { useSearchParams } from 'react-router-dom';
import { SessionType } from '@/types/session';

const typeMap: Record<string, SessionType> = {
  quick_prep: 'quick_prep',
  quick: 'quick_prep',
  full_mock: 'full_mock',
  mock: 'full_mock',
  premium_audio: 'premium_audio',
  audio: 'premium_audio',
  pro: 'pro',
  subscription: 'pro',
};

// Map for pre-selected interview types (used when session_type=pro&type=xxx)
const interviewTypeMap: Record<string, 'quick_prep' | 'full_mock' | 'premium_audio'> = {
  quick_prep: 'quick_prep',
  quick: 'quick_prep',
  full_mock: 'full_mock',
  mock: 'full_mock',
  premium_audio: 'premium_audio',
  audio: 'premium_audio',
};

export function useSessionParams() {
  const [searchParams] = useSearchParams();

  const rawType = searchParams.get('session_type');
  const rawEmail = searchParams.get('email');
  const rawInterviewType = searchParams.get('type'); // Pre-selected interview type for Pro subscribers

  const sessionType = rawType ? typeMap[rawType.toLowerCase()] ?? null : null;
  const userEmail = rawEmail ? decodeURIComponent(rawEmail) : null;
  
  // Pre-selected interview type (only valid for Pro session type)
  const preSelectedInterviewType = rawInterviewType 
    ? interviewTypeMap[rawInterviewType.toLowerCase()] ?? null 
    : null;

  return { sessionType, userEmail, preSelectedInterviewType };
}

