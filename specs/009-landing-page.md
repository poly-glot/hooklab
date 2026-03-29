# 009 - Landing Page

## Feature Name
Marketing Landing Page

## Description
A public-facing editorial-style landing page that introduces the Hooklab platform, showcases key features, and drives visitors to sign up. Includes interactive mockups of the dashboard and script editor, a features grid, split-section product explanations, a how-it-works stepper, and a call-to-action section. Built with custom CSS (no Tailwind) for a distinct editorial aesthetic.

## User Stories
- As a visitor, I want to understand what the platform does, so that I can decide whether to try it.
- As a visitor, I want to see visual examples of the product, so that I can gauge its quality and design.
- As a visitor, I want clear calls-to-action, so that I can start using the product quickly.

## Components Involved
- `client/src/pages/landing/LandingPage.tsx` -- Full landing page component with inline mock components
- `client/src/index.css` -- All landing page styles (`.lp-*` class namespace)

## Page Sections

### 1. Navigation Bar
- Sticky nav with logo "Hooklab"
- Links: Features, Scripting, Endpoints (anchor links)
- "Get Started" CTA button -> navigates to `/auth`

### 2. Hero Section
- Two-column grid: text content + dashboard mockup
- Label: "WEBHOOK TESTING PLATFORM"
- Headline: "Inspect, debug and transform webhooks in real time"
- Subtitle: product description
- CTAs: "Start Testing" (primary) and "See How It Works" (outline, anchor to features)
- **HeroDashboardMock**: Browser chrome mockup showing the dashboard with endpoint rows, filter pills, search bar

### 3. Features Grid (6 features)
- 3-column grid with 1px borders
- Features: Instant Endpoints, JavaScript Scripting, Sandboxed Execution, Deep Inspection, Real-time Updates, Method Agnostic
- Each with lucide-react icon, title, description

### 4. Scripting Section (split layout)
- Left: Text explaining programmable webhook responses with bullet points
- Right: **ScriptEditorMock** -- Browser chrome mockup with fake code editor showing syntax-highlighted JavaScript and a test result bar

### 5. Endpoints Section (split layout, reversed)
- Left: **EndpointsMock** -- 2x3 grid of endpoint cards with status dots, method badges, names, paths
- Right: Text explaining multiple endpoint management with bullet points

### 6. How It Works (3 steps)
- Three-column stepper: Create an endpoint -> Send webhooks -> Inspect & transform

### 7. Call to Action
- Dark background section
- "Stop guessing. Start inspecting."
- "Get Started -- Free" button

### 8. Footer
- Dark background with logo, "Free and open source" tagline
- Links: Features, Scripting, Endpoints, GitHub

## Business Rules
- All CTA buttons navigate to `/auth` (the authentication page)
- Anchor links (#features, #scripting, #endpoints) scroll to corresponding sections
- The landing page is a public route accessible without authentication
- Authenticated users who visit `/` see the landing page (no auto-redirect from landing to dashboard)

## Dependencies
- React Router (for navigation)
- lucide-react (for feature icons)

## Current Status
**Implemented** -- Fully functional with responsive design (breakpoints at 1024px and 768px). All mockups are purely decorative (no interactivity).

## Technical Notes
- The landing page uses a custom CSS design system with the `.lp-` prefix namespace, completely separate from the Tailwind-based application CSS.
- Responsive breakpoints: at 1024px, hero becomes single-column, feature grid becomes 2-column; at 768px, everything becomes single-column, nav links hide, CTAs stack vertically.
- Mockup components (HeroDashboardMock, ScriptEditorMock, EndpointsMock) are defined inline in LandingPage.tsx, not as separate files.
- The code mockup in ScriptEditorMock uses individual `<span>` elements with syntax-highlighting CSS classes (`.lp-code-comment`, `.lp-code-keyword`, `.lp-code-fn`, `.lp-code-string`, `.lp-code-number`).
- Font: "Helvetica Neue" primary, system-ui fallback. Monospace: "SF Mono", "Fira Code" family.
