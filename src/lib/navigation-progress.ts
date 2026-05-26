export function isRouteNavigation({
  currentHref,
  target,
  targetHref,
}: {
  currentHref: string;
  target?: string | null;
  targetHref: string;
}) {
  if (target && target !== "_self") {
    return false;
  }

  const currentUrl = new URL(currentHref);
  const targetUrl = new URL(targetHref, currentUrl);

  if (targetUrl.origin !== currentUrl.origin) {
    return false;
  }

  return `${targetUrl.pathname}${targetUrl.search}` !==
    `${currentUrl.pathname}${currentUrl.search}`;
}
