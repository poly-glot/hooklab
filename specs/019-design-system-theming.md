# 019 - Design System and Theming

## Feature Name
Design System and Visual Theming

## Description
A dual design system consisting of Tailwind CSS with shadcn/ui components for the application UI, and a custom CSS design system for the landing page. Includes CSS custom properties for theming, dark mode support (defined but not actively used), and consistent design tokens.

## User Stories
- As a user, I want a consistent, professional visual experience across the application.
- As a developer, I want reusable UI components, so that I can build features quickly with consistent styling.

## Components Involved
- `client/src/index.css` -- Global styles, CSS custom properties, landing page styles
- `client/src/components/ui/` -- shadcn/ui component library (button, card, dialog, dropdown-menu, input, label, badge, separator, scroll-area, sonner)
- `client/src/components/webhook/` -- Custom webhook-specific components

## Design Tokens

### Brand Colors
| Token | Value | Usage |
|-------|-------|-------|
| `--brand` | #01189b | Primary brand blue |
| `--tab-inactive` | #686868 | Inactive text |
| Active status | #3ebe91 / #28c88e | Green status indicators |
| Destructive | #ac1b11 | Delete actions |
| Background | #f8f8f8 | Page backgrounds |
| Border | #d9d9d9 | Default borders |
| Muted text | #686868, #919493, #989a9c | Secondary text variants |

### Typography
- Primary font: "Helvetica Neue", system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif
- Monospace: "SF Mono", "Fira Code", "Fira Mono", "Roboto Mono", monospace
- Editor font: "JetBrains Mono", "Fira Code", "Cascadia Code", ui-monospace, monospace

### Component Sizing
| Component | Dimensions |
|-----------|-----------|
| AppHeader/Footer | h-[50px] |
| Action bar | h-[80px] |
| Filter pill | w-[103px] h-[23px] |
| WebhookCard | min-h-[60px] md:h-[76px] |
| Method badge | h-[25px] w-[64px] |
| Request list item | h-[40px] |
| "ADD NEW" button | h-[40px] w-[131px] |
| Sidebar | w-[320px] |
| Tab button | h-[41px] w-[131px] |

## CSS Architecture

### Application UI (Tailwind + shadcn/ui)
- Uses Tailwind utility classes throughout
- shadcn/ui components provide Dialog, DropdownMenu, Input, Label, Badge, Button, Card, Separator, ScrollArea
- CSS custom properties defined in `:root` for shadcn/ui theme compatibility
- Dark mode variables defined in `.dark` class (not actively toggled)

### Landing Page (Custom CSS)
- All classes prefixed with `lp-` namespace
- Responsive breakpoints: 1024px, 768px
- Grid-based layouts for features, steps, endpoints
- Custom button styles (primary, outline, CTA)
- Browser mockup components with chrome styling
- Code editor mockup with syntax highlighting classes

## Method Badge Color Coding
| Method | Color | Text |
|--------|-------|------|
| GET | #447ef3 | white |
| POST | #d9d9d9 | #686868 |
| DELETE | #ac1b11 | white |
| PUT | #447ef3 | white |
| PATCH | #686868 | white |

## Business Rules
- The design uses square/minimal border-radius for action buttons (brand aesthetic)
- Rounded corners used for cards (rounded-lg), pills (rounded-full), and dialogs (rounded-2xl)
- Dark mode CSS variables are defined but no toggle mechanism exists
- The landing page uses a completely separate CSS system from the application

## Dependencies
- Tailwind CSS
- shadcn/ui component library
- lucide-react icon library

## Current Status
**Implemented** -- Design system is complete and consistent across the application. Dark mode is defined in CSS but not activated.

## Technical Notes
- The `--radius` CSS variable (0.5rem) controls the default border-radius for shadcn/ui components.
- The landing page CSS avoids Tailwind to achieve a distinct editorial aesthetic with precise control over typography and spacing.
- The `.lp-features-grid` uses `gap: 1px` with a colored background to create 1px borders between grid cells -- a CSS grid trick that avoids double-border issues.
- Font sizes throughout the application use pixel values (text-[12px], text-[14px]) rather than Tailwind's default rem-based scale for precise control.
