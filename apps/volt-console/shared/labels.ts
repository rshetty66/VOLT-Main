/** "icon name", or just the name: the VOLT registry ships no icons, so most are empty. */
export const labelOf = (x: { icon?: string | null; name: string }) => (x.icon?.trim() ? `${x.icon.trim()} ${x.name}` : x.name);
