// Design Tokens پایه مطابق plan.md
export const color = {
  primary: 'hsl(var(--primary))',
  success: 'hsl(var(--success))',
  warning: 'hsl(var(--warning))',
  danger: 'hsl(var(--destructive))',
  bg: 'hsl(var(--background))',
  fg: 'hsl(var(--foreground))'
};

export const radius = { sm: '4px', md: '8px', lg: '16px' } as const;
export const spacing = { xs: 4, sm: 8, md: 12, lg: 20, xl: 32 } as const;
export const motion = { fast: '120ms', base: '200ms', slow: '320ms' } as const;
export const z = { header: 40, overlay: 100, modal: 120 } as const;

export type TokenColor = keyof typeof color;
export type TokenRadius = keyof typeof radius;
export type TokenSpacing = keyof typeof spacing;

export const tokens = { color, radius, spacing, motion, z };
export default tokens;
