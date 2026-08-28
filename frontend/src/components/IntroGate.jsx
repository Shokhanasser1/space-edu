import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { hasSeenIntro } from '@/views/intro/introSeen';

/**
 * The front door. A visitor who is signed out and has not been through the
 * intro is sent to /welcome; everybody else gets the page they asked for.
 *
 * The flag is read once, on mount: a signed-out visitor who presses Skip is
 * navigated home by the intro itself, and must not be bounced straight back
 * because the store read happened before the flag was written.
 */
export default function IntroGate({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [seen] = useState(() => hasSeenIntro());

  if (!isAuthenticated && !seen) return <Navigate to="/welcome" replace />;
  return children;
}
