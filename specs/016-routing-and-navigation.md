# 016 - Routing and Navigation Guards

## Feature Name
Client-Side Routing with Authentication Guards

## Description
React Router-based client-side routing with two route guard components (ProtectedRoute and PublicRoute) that enforce authentication state. Unauthenticated users are redirected away from protected pages, and authenticated users are redirected away from the login page.

## User Stories
- As an unauthenticated user, I want to be redirected to the login page when I access a protected route, so that I know I need to sign in.
- As an authenticated user, I want to be redirected to the dashboard when I visit the login page, so that I don't see unnecessary login UI.
- As a user, I want a loading indicator while authentication state is being determined, so that I don't see flickering.

## Components Involved
- `client/src/App.tsx` -- Route definitions, ProtectedRoute, PublicRoute

## Routes
| Path | Component | Guard | Description |
|------|-----------|-------|-------------|
| `/` | LandingPage | None | Public landing page |
| `/auth` | AuthPage | PublicRoute | Login/register (redirects to /dashboard if logged in) |
| `/dashboard` | DashboardPage | ProtectedRoute | Endpoint listing |
| `/dashboard/endpoint/:id` | EndpointDetail | ProtectedRoute | Endpoint request inspector |

## Route Guards

### ProtectedRoute
- If `isLoading`: Shows centered "Loading..." text
- If `!user`: Redirects to `/auth` via `<Navigate to="/auth" replace />`
- Otherwise: Renders children

### PublicRoute
- If `isLoading`: Shows centered "Loading..." text
- If `user`: Redirects to `/dashboard` via `<Navigate to="/dashboard" replace />`
- Otherwise: Renders children

## Business Rules
- The landing page (`/`) is accessible to all users regardless of auth state
- Authentication state is resolved asynchronously (Firebase `onAuthStateChanged`)
- During auth loading, a minimal loading indicator is shown (no flash of wrong content)
- The `replace` prop on Navigate prevents the redirect from creating a browser history entry
- The Toaster component (sonner) is rendered at the App level for global toast notifications (bottom-right position)

## Dependencies
- [001 - Authentication](001-authentication.md) -- AuthProvider and useAuth hook
- React Router DOM

## Current Status
**Implemented** -- All routes and guards are functional.

## Technical Notes
- The AuthProvider wraps the entire app, so auth state is available to all components via the useAuth hook.
- 404 handling is not implemented on the client side -- unknown routes would show a blank page since there is no catch-all route. The server-side handles 404 for API/webhook routes.
- The loading state check prevents a common issue where Firebase Auth has not yet determined the user's session on page load, which would cause a momentary redirect to `/auth` before snapping back to the intended page.
