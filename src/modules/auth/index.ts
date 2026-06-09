// Auth module
// Responsibilities:
//   - Sign up / sign in / sign out / password reset
//   - Session management (access token, refresh token)
//   - Profile provisioning (created via handle_new_user trigger)
//
// Server functions (createServerFn):
//   - signIn(email, password) → session
//   - signUp(email, password, fullName) → user + profile
//   - signOut() → void
//   - resetPassword(email) → void
//   - getSession() → session | null
//
// Hooks:
//   - useSession() → session | null
//   - useCurrentUser() → User | null
//
// Components:
//   - LoginForm
//   - SignupForm
//   - ResetPasswordForm

export {};
