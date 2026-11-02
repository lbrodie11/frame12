export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://frame12.dev').replace(
  /\/+$/,
  '',
);

export const REGISTRY_BASE_URL = (
  process.env.NEXT_PUBLIC_REGISTRY_URL || `${SITE_URL}/r`
).replace(/\/+$/, '');
