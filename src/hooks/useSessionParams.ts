import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SessionType } from '@/types/session';

export function useSessionParams() {
  const [searchParams] = useSearchParams();
  const [sessionType, setSessionType] = useState<SessionType | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const type = searchParams.get('session_type');
    const email = searchParams.get('email');

    // Map URL params to session types
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

    if (type && typeMap[type.toLowerCase()]) {
      setSessionType(typeMap[type.toLowerCase()]);
    }

    if (email) {
      setUserEmail(decodeURIComponent(email));
    }
  }, [searchParams]);

  return { sessionType, userEmail };
}
