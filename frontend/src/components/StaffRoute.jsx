import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * Guards routes that only staff may see.
 *
 * /admin-panel used to sit behind plain ProtectedRoute, so any signed-in
 * student could load the admin dashboard. The backend rejects the data with
 * IsAdminUser, so nothing leaked, but the whole admin surface rendered and
 * filled with 403s.
 *
 * Both refusals go to the admin sign-in, not to the pupils' one or the home
 * page. Signed out, that is where a member of staff signs in and comes back
 * here. Signed in without staff rights, it says so — the old silent bounce to
 * "/" left an administrator signed in on the wrong account with no idea why
 * the panel would not open.
 */
export default function StaffRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isStaff = useAuthStore((s) => Boolean(s.user?.is_staff));
  const location = useLocation();

  if (!isAuthenticated || !isStaff) {
    return <Navigate to="/admin-panel/login" replace state={{ from: location }} />;
  }
  return <Outlet />;
}
