# 004 - Dashboard / Endpoint Listing

## Feature Name
Dashboard with Endpoint Listing

## Description
The main authenticated view showing all webhook endpoints owned by the current user. Provides search, filtering by status, endpoint creation, and navigation to endpoint detail views. Features a responsive layout with an action bar, filter pills, and endpoint cards.

## User Stories
- As a user, I want to see all my webhook endpoints in one place, so that I can manage them efficiently.
- As a user, I want to search endpoints by name or URL, so that I can quickly find a specific endpoint.
- As a user, I want to filter endpoints by status (All/Active/Closed), so that I can focus on relevant endpoints.
- As a user, I want to see endpoint metadata (name, URL, creation date, status, stats) at a glance, so that I can assess endpoint activity.
- As a user, I want to navigate to an endpoint's detail view, so that I can inspect incoming requests.

## Components Involved
- `client/src/pages/dashboard/DashboardPage.tsx` -- Main dashboard page
- `client/src/components/webhook/AppHeader.tsx` -- Application header with logo and GitHub link
- `client/src/components/webhook/AppFooter.tsx` -- Application footer with copyright
- `client/src/components/webhook/FilterPill.tsx` -- Status filter pill (All/Active/Closed with counts)
- `client/src/components/webhook/WebhookCard.tsx` -- Endpoint card component
- `client/src/components/webhook/index.ts` -- Barrel export for all webhook components

## Data Model
Uses the Endpoint type from [002](002-webhook-endpoint-management.md). FilterType is `'all' | 'active' | 'closed'`.

## UI Flow
1. User navigates to `/dashboard` (protected route)
2. Page loads endpoints from Firestore via `getEndpoints(user.id)`
3. **Action Bar** (top): status text, search input, "ADD NEW" button
4. **Filter Pills** below action bar: All (count), Active (count), Closed (count) -- each toggleable
5. **Endpoint List**: Cards displayed vertically with 19px gap
6. Each card shows:
   - Status dot (blue, for active endpoints)
   - Endpoint name (blue text, clickable)
   - Webhook URL (`{origin}/w/{id}`)
   - Creation date with calendar icon
   - Status indicator (green "Active" or grey "Closed")
   - Stats count
   - Options button (three dots) opening a dropdown with "Delete" action
7. Clicking a card navigates to `/dashboard/endpoint/{id}`
8. **Empty state**: Message "No endpoints yet" with "ADD NEW" button (if no filters active), or "No endpoints match your filter"
9. **Loading state**: "Loading endpoints..." centered text

## Business Rules
- Search is case-insensitive and matches against endpoint name and webhook URL
- Filter and search are combined (both must match for an endpoint to display)
- All endpoints are currently treated as "active" (no explicit status toggle exists)
- Filter pill counts reflect pre-search totals (counts from full endpoint list)
- Endpoint cards are ordered by creation date descending (newest first, from Firestore query)

## Dependencies
- [001 - Authentication](001-authentication.md) -- User must be authenticated (ProtectedRoute)
- [002 - Webhook Endpoint Management](002-webhook-endpoint-management.md) -- Endpoint CRUD operations

## Current Status
**Implemented** -- Fully functional with search, filtering, creation dialog, and deletion with confirmation.

## Technical Notes
- The dashboard fetches endpoints on mount and when the user changes; it does not use real-time Firestore listeners (though `onEndpointsSnapshot` is available in firestore.ts).
- The `getEndpointStatus` function is a stub that always returns `'active'` since the Endpoint type has no explicit status field. The "Closed" filter effectively shows zero results.
- The WebhookCard component uses `forwardRef` for its OptionsButton to support Radix DropdownMenuTrigger attachment.
- The options dropdown uses shadcn/ui DropdownMenu components.
- Responsive design: on mobile, creation date, status, and stats metadata are hidden; the search bar collapses to full-width.
