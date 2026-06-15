export const CANONICAL_VIEWER_HOST = "viewer.twi-twi.com";
export const CLOUDFLARE_PAGES_HOST = "twi-twi-viewer.pages.dev";
export const CANONICAL_REDIRECT_ENABLED = true;

export function shouldRedirectToCanonical(hostname: string): boolean {
  return CANONICAL_REDIRECT_ENABLED && hostname === CLOUDFLARE_PAGES_HOST;
}
