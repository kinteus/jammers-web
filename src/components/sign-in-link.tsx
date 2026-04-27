"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type ComponentProps, type ReactNode } from "react";

import { buildProfileSignInHref } from "@/lib/return-to";

type SignInLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  children: ReactNode;
  returnTo?: string;
};

export function SignInLink({
  children,
  returnTo: returnToOverride,
  ...props
}: SignInLinkProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [hash, setHash] = useState("");

  useEffect(() => {
    function syncHash() {
      setHash(window.location.hash);
    }

    syncHash();
    window.addEventListener("hashchange", syncHash);

    return () => {
      window.removeEventListener("hashchange", syncHash);
    };
  }, []);

  const href = useMemo(() => {
    return buildProfileSignInHref({
      pathname,
      search: searchParams.toString(),
      hash,
      returnToOverride,
    });
  }, [hash, pathname, returnToOverride, searchParams]);

  return (
    <Link {...props} href={href}>
      {children}
    </Link>
  );
}
