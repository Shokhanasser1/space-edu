import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * The other half of ProtectedRoute: keeps a signed-in person off the sign-in
 * screens.
 *
 * Not tidiness. On a shared school computer the sign-in form reached while
 * somebody else is still signed in is how one child ends up looking at another
 * child's account, and "forgot password" reached that way sends a code for an
 * address they are not looking at.
 */
export default function GuestRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <Outlet />;
}
