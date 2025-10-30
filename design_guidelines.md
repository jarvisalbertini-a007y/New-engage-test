# AI Sales Engagement Platform - Design Guidelines

## Design Approach

**Selected System:** Fluent Design principles adapted for extended-use productivity applications, with custom soft UI specifications prioritizing eye comfort and calm focus.

**Core Philosophy:** Create a serene, distraction-free workspace that feels spacious and breathable while maintaining information density. Every element should reduce cognitive load rather than demand attention.

## Typography System

**Font Stack:**
- Primary: Inter (400, 500, 600 weights)
- Monospace: JetBrains Mono (for data/metrics)

**Type Scale:**
- Display headings: text-2xl/3xl (very rare, dashboard headers only)
- Section headers: text-lg font-medium
- Body text: text-sm (primary reading size)
- Small text/labels: text-xs
- Metrics/numbers: text-xl font-semibold (monospace)

**Critical:** Use medium gray text (not pure black) for reduced eye strain. Primary text opacity ~80%, secondary ~60%.

## Layout System

**Spacing Primitives:** Standardize on Tailwind units of 2, 3, 4, 6, 8, 12 for consistent rhythm.

**Grid Structure:**
- Collapsible sidebar: 64px collapsed, 240px expanded
- Main content: max-w-7xl with px-6 lg:px-8 container
- Card spacing: gap-4 for tight grids, gap-6 for breathing room
- Section padding: py-6 standard, py-8 for major sections

**Sidebar Specifications:**
- Soft shadow when expanded: subtle, blurred 2-3px
- Transition duration: 300ms ease-in-out for collapse/expand
- Icon-only mode when collapsed with tooltip on hover
- Navigation items: py-3 px-4, rounded-lg, generous touch targets

**Responsive Breakpoints:**
- Mobile (<768px): Sidebar becomes overlay drawer
- Tablet (768px-1024px): Sidebar auto-collapses to icons
- Desktop (>1024px): Full expanded sidebar by default

## Component Library

### Navigation & Structure

**Top Bar:**
- Height: 64px fixed
- Contents: Search (w-80), user profile, notifications bell, quick actions
- Soft bottom border with gradient fade
- Backdrop blur effect for depth

**Sidebar Navigation:**
- Group sections with subtle uppercase labels (text-xs, letter-spacing-wide)
- Active state: soft background fill with left accent line (3px rounded)
- Icons: 20px, consistent line weight
- Hover: gentle background tint, no sharp transitions
- Bottom section: User settings, help docs

### Data Display Components

**Cards:**
- Rounded corners: rounded-xl (12px)
- Padding: p-6
- Soft shadow: shadow-sm with blur
- No hard borders; use subtle background differentiation
- Stacked header: title + actions in flex justify-between

**Tables:**
- Zebra striping with ultra-subtle background alternation
- Row hover: gentle background shift, not color change
- Cell padding: px-4 py-3
- Header: sticky position, font-medium, smaller text-xs uppercase tracking-wide
- Pagination: rounded pill design, understated

**Stats/Metrics Cards:**
- Large number display (text-3xl monospace)
- Trend indicators: soft arrows, muted colors
- Sparkline charts: thin strokes, gradient fills
- Grid layout: grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4

### Forms & Inputs

**Input Fields:**
- Height: h-10 standard
- Rounded: rounded-lg
- Border: 1px solid with soft gray, thicker on focus (2px)
- Focus state: subtle glow (shadow-sm), no color shift
- Placeholder: low opacity, gentle guidance
- Labels: text-sm font-medium, mb-2, aligned left

**Buttons:**
- Primary: soft gradient background, rounded-lg, px-6 py-2.5
- Secondary: outlined with soft border, transparent background
- Text buttons: no background, underline on hover
- Disabled: reduced opacity (50%), no color change
- Consistent height: h-10

**Dropdowns/Selects:**
- Custom styled to match input fields
- Menu: soft shadow, rounded-lg, py-2
- Options: px-4 py-2, hover with gentle background
- Max height with scroll for long lists

### Interactive Elements

**Modals/Overlays:**
- Backdrop: soft blur with gentle darkening
- Modal: max-w-2xl, rounded-2xl, p-8
- Slide-in animation: 250ms from center-bottom
- Close button: top-right, rounded-full background on hover

**Tabs:**
- Borderless design with bottom indicator
- Active: subtle background fill + bottom accent (2px rounded)
- Spacing: gap-6 between tabs
- Transition: 200ms on indicator movement

**Toast Notifications:**
- Fixed bottom-right position
- Slide-in from right: 300ms
- Rounded-xl, p-4, soft shadow
- Auto-dismiss: 4s with progress bar
- Icon + message + close button layout

## Animations & Transitions

**Global Principles:**
- Default transition: 200ms ease-in-out
- Sidebar collapse/expand: 300ms
- Page transitions: 150ms fade
- Micro-interactions: 100-150ms (hover states)

**Scroll Behavior:**
- Smooth scroll enabled globally
- Sticky headers with subtle shadow on scroll
- Lazy load content with gentle fade-in

**Loading States:**
- Skeleton screens with soft pulse animation
- Spinner: minimal, thin stroke, slow rotation
- Progress bars: gradient fill, rounded-full

## Accessibility Standards

- Focus outlines: 2px offset, rounded to match element, visible but soft
- Keyboard navigation: clear visual indicators throughout
- ARIA labels: comprehensive implementation
- Color contrast: WCAG AA minimum, optimized for long-form reading
- Touch targets: minimum 44px for all interactive elements
- Screen reader: semantic HTML structure with descriptive labels

## Images Section

**Dashboard Welcome Area (Not traditional hero):**
- Placement: Top of main content area when no active task
- Image type: Soft illustration or abstract workspace scene
- Dimensions: Full-width, 240px height
- Treatment: Subtle gradient overlay (top to transparent)
- Content over image: Welcome message + quick action buttons with backdrop-blur background
- Purpose: Warm greeting, reduce empty state harshness

**Empty States:**
- Illustrations: Soft, minimal line drawings
- Placement: Center of content area
- Size: 200px x 200px maximum
- Purpose: Guide users, reduce frustration

**No large hero image** - this is a work application focused on efficiency.

---

**Implementation Note:** All gradients should be extremely subtle (5-10% opacity differences). The entire interface maintains a whisper-quiet aesthetic where information hierarchy comes from spacing, typography weight, and gentle contrast rather than bold colors or dramatic effects.