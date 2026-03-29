# 007 - Webhook Filtering and Search

## Feature Name
Webhook Endpoint Filtering and Search

## Description
A combined filtering and search system on the dashboard that allows users to narrow down their endpoint list by status (All/Active/Closed) and by text search matching endpoint names or URLs. Filter pills display counts and provide visual feedback on the active filter.

## User Stories
- As a user, I want to filter endpoints by status, so that I can focus on active or inactive endpoints.
- As a user, I want to search endpoints by name or URL, so that I can quickly locate a specific endpoint.
- As a user, I want to see how many endpoints match each filter category, so that I can understand my endpoint distribution.

## Components Involved
- `client/src/pages/dashboard/DashboardPage.tsx` -- Filter state management, search input, filtering logic
- `client/src/components/webhook/FilterPill.tsx` -- Styled filter pill button with label and count

## Data Model
```typescript
type FilterType = 'all' | 'active' | 'closed';
```

## UI Flow
1. Three filter pills displayed horizontally: All, Active, Closed
2. Active pill is green (#28c88e) with white text; inactive pills are white with grey border
3. Each pill shows a label and a zero-padded count (e.g., "08")
4. Clicking a pill sets it as the active filter
5. Search input is in the action bar with a search icon and "search by webhook" placeholder
6. Search and filter are combined: endpoints must match both the current filter AND the search query
7. When no endpoints match, contextual empty state message is shown

## Business Rules
- Search is case-insensitive
- Search matches against: endpoint name, full webhook URL (`{origin}/w/{id}`)
- Filter counts are computed from the full endpoint list (not affected by search)
- All endpoints currently return "active" status (no closed endpoints in practice)
- The count in each pill is zero-padded to 2 digits (e.g., "02", "12")
- Filter pills have a fixed width of 103px and height of 23px

## Dependencies
- [004 - Dashboard](004-dashboard-endpoint-listing.md) -- Part of the dashboard page

## Current Status
**Implemented** -- Filtering and search are functional. The "Closed" filter always returns zero results since there is no explicit endpoint deactivation mechanism.

## Technical Notes
- The `getEndpointStatus` function is hardcoded to return `'active'` for all endpoints. When an endpoint status/deactivation feature is added, this function should read from the endpoint's data.
- FilterPill is a pure presentational component -- all state management is in DashboardPage.
- The filter pill component is 103px wide to accommodate the label and count side-by-side.
