/*
# Allow SECURITY DEFINER function is_admin() for RLS policy evaluation
*/

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated, anon, service_role;
