# Perzike UI controls

These application controls use HeroUI v3 compound components while retaining
the props and appearance used by Perzike's existing pages. There is no HeroUI v2
runtime or Tailwind plugin dependency.

- `controls.tsx`: buttons, inputs, switches, checkboxes and radios.
- `collections.tsx`: selects, tabs, accordions and menus. Item descriptors retain
  explicit React keys, including empty keys and items inside fragments.
- `surfaces.tsx`: cards, chips, badges, dialogs, tooltips and pagination.
- `shared.ts`: shared appearance types, color tokens and item traversal.

`assets/app-theme.css` preserves the application palette. Its `--heroui-*`
variables are application-owned tokens still used by custom CSS, not an old
framework dependency. `assets/app-controls.css` restores control geometry in
the `app` cascade layer, between HeroUI components and Tailwind utilities.
Page-specific utility classes therefore remain able to override dimensions.

Use these controls when working on existing screens. Components already built
with the v3 compound API can import `@heroui/react` directly. When adding a prop
here, implement its behavior rather than accepting and silently dropping it.

When updating HeroUI, check both themes, acrylic surfaces, compact sidebar cards,
controlled single/multiple selection, fragment items, nested card actions,
keyboard and backdrop dismissal, validation tooltip anchors, and the tray and
floating-window entry points.
