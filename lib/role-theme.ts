export const ROLE_THEMES = {
  admin: {
    accent: '#3b82f6',
    gradientFrom: '#2563eb',
    gradientTo: '#1d4ed8',
    accentLine: '#93c5fd',
    accentLineBright: '#dbeafe',
    badgeBorder: '#1d4ed8',
  },
  center_head: {
    accent: '#06b6d4',
    gradientFrom: '#0891b2',
    gradientTo: '#0e7490',
    accentLine: '#67e8f9',
    accentLineBright: '#cffafe',
    badgeBorder: '#0e7490',
  },
  invigilator: {
    accent: '#10b981',
    gradientFrom: '#059669',
    gradientTo: '#047857',
    accentLine: '#6ee7b7',
    accentLineBright: '#d1fae5',
    badgeBorder: '#047857',
  },
} as const;

export type RoleId = keyof typeof ROLE_THEMES;

export function getRoleTheme(role?: string) {
  if (role && role in ROLE_THEMES) {
    return ROLE_THEMES[role as RoleId];
  }
  return ROLE_THEMES.admin;
}

export function getNavbarRoleClass(role?: string) {
  if (role && role in ROLE_THEMES) {
    return `navbar--${role}`;
  }
  return 'navbar--admin';
}

export function getTabGroupClass(role?: string) {
  if (role && role in ROLE_THEMES) {
    return `tab-group--${role}`;
  }
  return 'tab-group--admin';
}
