---
name: Premium Guest Management
colors:
  surface: '#f8fbef'
  surface-dim: '#d8dbd0'
  surface-bright: '#f8fbef'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f5ea'
  surface-container: '#ecefe4'
  surface-container-high: '#e6e9de'
  surface-container-highest: '#e0e4d9'
  on-surface: '#191d16'
  on-surface-variant: '#41493c'
  inverse-surface: '#2e322a'
  inverse-on-surface: '#eff2e7'
  outline: '#717a6b'
  outline-variant: '#c1c9b8'
  surface-tint: '#2f6b19'
  primary: '#124900'
  on-primary: '#ffffff'
  primary-container: '#266210'
  on-primary-container: '#99dc7c'
  inverse-primary: '#95d878'
  secondary: '#376a29'
  on-secondary: '#ffffff'
  secondary-container: '#b5ef9f'
  on-secondary-container: '#3b6e2d'
  tertiary: '#344400'
  on-tertiary: '#ffffff'
  tertiary-container: '#475d00'
  on-tertiary-container: '#b0da33'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#b0f591'
  primary-fixed-dim: '#95d878'
  on-primary-fixed: '#052100'
  on-primary-fixed-variant: '#165200'
  secondary-fixed: '#b8f2a2'
  secondary-fixed-dim: '#9cd588'
  on-secondary-fixed: '#022100'
  on-secondary-fixed-variant: '#1f5113'
  tertiary-fixed: '#c7f24b'
  tertiary-fixed-dim: '#abd52e'
  on-tertiary-fixed: '#161f00'
  on-tertiary-fixed-variant: '#3b4d00'
  background: '#f8fbef'
  on-background: '#191d16'
  surface-variant: '#e0e4d9'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 40px
  xl: 64px
  gutter: 16px
  margin-mobile: 20px
  margin-desktop: 48px
---

## Brand & Style

The brand personality is **Professional, Organic, and Sophisticated**. It targets high-end corporate environments and modern residential complexes that prioritize a seamless, welcoming entry experience.

The design style is **Corporate / Modern** with a strong leaning toward **Minimalism**. It follows the Apple Human Interface Guidelines (HIG) by prioritizing clarity, deference, and depth. The aesthetic uses generous whitespace to reduce cognitive load during check-in and employs a "Naturalist Premium" vibe—using deep greens and organic tones to differentiate from standard cold blue enterprise software. The emotional response should be one of calm efficiency and trust.

## Colors

The palette is anchored in a lush, forest-inspired green scale. 
- **Primary & Primary Dark** are used for core branding, active states, and primary actions.
- **Accent & Highlight** are reserved for success states, VIP indicators, and attention-grabbing data points.
- **Background** uses a very desaturated green tint (#F8FBF6) to reduce eye strain and feel more "premium" than pure digital white.
- **Neutral/Surface** colors follow standard accessibility patterns to ensure high legibility for visitors of all ages.

## Typography

This design system utilizes **Inter** for its exceptional legibility and neutral, professional character. 

The type hierarchy is "Display-Heavy." Large page titles provide immediate context for visitors who may be in a hurry. 
- **Weight Strategy:** Use Bold (700) for page headers, SemiBold (600) for section titles/sub-headers, and Regular (400) for all instructional and input text.
- **Line Height:** Tight for headers to maintain impact; generous (1.5x+) for body text to improve readability on tablets and kiosks.

## Layout & Spacing

The layout is built on a strict **8px linear grid** to ensure visual harmony across various device sizes.

- **Grid Model:** 12-column fluid grid for desktop/tablet; 4-column fluid for mobile.
- **Content Width:** Max-width of 1200px for dashboard views; centered narrow layouts (600px) for guest registration forms to focus attention.
- **Vertical Rhythm:** Components are separated by `lg` (40px) or `xl` (64px) units to maintain the spacious, premium feel. 
- **Touch Targets:** All interactive elements must maintain a minimum height of 48px, with 56px preferred for primary registration buttons.

## Elevation & Depth

Visual hierarchy is established through **Tonal Layers** and **Ambient Shadows**.

- **Surfaces:** Cards and primary containers use `surface_white`. They are elevated above the `#F8FBF6` background.
- **Shadows:** Use a "Natural Ambient" shadow style: `0px 4px 20px rgba(6, 59, 0, 0.04)`. Note the subtle primary-dark tint in the shadow to keep it from looking "dirty" or gray.
- **Interaction Depth:** On tap/hover, buttons should not lift further; instead, they should use a subtle inner-shadow or slight scale-down effect (0.98x) to mimic physical pressing.
- **Outlines:** Use 1px solid `border_subtle` for secondary elements (like list items or input fields) to maintain structure without adding visual noise.

## Shapes

The shape language is defined by **large, friendly radiuses**. 

- **Primary Cards/Containers:** Use `rounded-xl` (1.5rem / 24px) to create a soft, inviting container for data.
- **Standard Components:** Buttons and Input Fields use `rounded-lg` (1rem / 16px).
- **Small Elements:** Chips, badges, and small icons use `rounded-sm` (0.5rem / 8px).
- **Icons:** Use 24px bounding boxes with a 1.5px or 2px stroke weight. Avoid filled icons unless indicating an active navigation state.

## Components

### Buttons
- **Primary:** Solid `primary_color`, white text. No border. Large padding (16px top/bottom).
- **Secondary:** White background, `primary_color` border (1.5px), `primary_color` text.
- **Ghost:** No background or border. `text_secondary` for idle, `primary_color` for active.

### Input Fields
- **State:** 1px border `border_subtle`. On focus, 2px border `primary_color`.
- **Label:** `label-md` placed above the field, never as placeholder text alone.
- **Affordance:** Clear "X" button for clearing text in long forms.

### Cards & Lists
- **Visitor Card:** White surface, subtle ambient shadow, `rounded-xl`. 
- **Status Chips:** Small, pill-shaped badges for "VIP", "Checked In", or "Expected". Use low-opacity backgrounds of the status color (e.g., success = 10% `primary_color` background).

### Navigation
- **Bottom Bar (Mobile):** High-blur backdrop (Glassmorphism effect) with a 1px top border. Large, simple outline icons.
- **Sidebar (Desktop):** Clean, vertical list with active indicators using a vertical green bar on the leading edge.

### Steppers
- Use a clean horizontal line with numbered circles for multi-step registration (Visitor Info > Purpose > Host > NDA). Use `primary_color` for completed steps and `border_subtle` for upcoming steps.