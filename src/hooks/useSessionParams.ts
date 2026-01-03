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

export function useSessionParams() {
  const [searchParams] = useSearchParams();

  const rawType = searchParams.get('session_type');
  const rawEmail = searchParams.get('email');

  const sessionType = rawType ? typeMap[rawType.toLowerCase()] ?? null : null;
  const userEmail = rawEmail ? decodeURIComponent(rawEmail) : null;

  return { sessionType, userEmail };
}

