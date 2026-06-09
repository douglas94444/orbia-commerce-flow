// Clients module — multi-tenant root
// Responsibilities:
//   - Client provisioning (create lojista account)
//   - Team member management (invite, role assignment)
//   - Health score calculation and persistence
//   - Onboarding stage tracking
//
// Server functions (createServerFn):
//   - provisionClient(name, plan) → client
//   - inviteMember(clientId, email, role) → client_member
//   - updateHealthScore(clientId, score) → void
//
// Hooks:
//   - useCurrentClient() → Client | null (resolved server-side, never from frontend)
//   - useClientMembers() → ClientMember[]
//
// RLS note: client_id is NEVER passed from the frontend.
//           All queries resolve via auth.current_client_id() in the DB.

export {};
