export interface UxSpec {
  styles: {
    colors: {
      bg: string;
      bgMuted: string;
      ink: string;
      inkMuted: string;
      accent: string;
      accentMuted: string;
      positive: string;
      warning: string;
      danger: string;
      border: string;
      card: string;
      cardShadow?: string;
    };
    typography: {
      font: string;
      scale: Array<{
        token: string;
        size: number;
        line: number;
        weight: number;
      }>;
    };
    radius: {
      sm: number;
      md: number;
      lg: number;
      xl: number;
      pill: number;
    };
    shadows: {
      card: { x: number; y: number; b: number; s: number; color: string };
      elevated: { x: number; y: number; b: number; s: number; color: string };
    };
  };
}

export function cssVar(name: string, value: string): string {
  return `--${name}: ${value};`;
}

export function applyTheme(spec: UxSpec): string {
  const c = spec.styles.colors;
  const r = spec.styles.radius;
  const s = spec.styles.shadows;
  const t = spec.styles.typography;

  const vars = [
    // Colors
    cssVar("color-bg", c.bg),
    cssVar("color-bg-muted", c.bgMuted),
    cssVar("color-ink", c.ink),
    cssVar("color-ink-muted", c.inkMuted),
    cssVar("color-accent", c.accent),
    cssVar("color-accent-muted", c.accentMuted),
    cssVar("color-positive", c.positive),
    cssVar("color-warning", c.warning),
    cssVar("color-danger", c.danger),
    cssVar("color-border", c.border),
    cssVar("color-card", c.card),
    
    // Shadows
    cssVar("shadow-card", c.cardShadow ?? "rgba(0,0,0,0.06)"),
    cssVar("shadow-elevated", s.elevated.color),
    
    // Radius
    cssVar("radius-sm", `${r.sm}px`),
    cssVar("radius-md", `${r.md}px`),
    cssVar("radius-lg", `${r.lg}px`),
    cssVar("radius-xl", `${r.xl}px`),
    cssVar("radius-pill", `${r.pill}px`),
    
    // Typography
    ...t.scale.map(({ token, size, line, weight }) => [
      cssVar(`font-${token}-size`, `${size}px`),
      cssVar(`font-${token}-line`, `${line}px`),
      cssVar(`font-${token}-weight`, `${weight}`),
    ]).flat(),
  ];

  return `:root { ${vars.join(" ")} }`;
}

export function injectThemeStyles(spec: UxSpec): void {
  const themeCSS = applyTheme(spec);
  const styleId = 'ux-spec-theme';
  
  // Remove existing theme if present
  const existing = document.getElementById(styleId);
  if (existing) {
    existing.remove();
  }
  
  // Inject new theme
  const style = document.createElement('style');
  style.id = styleId;
  style.innerHTML = themeCSS;
  document.head.appendChild(style);
}