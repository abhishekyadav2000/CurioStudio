"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const KEY_ROUTES = [
  "/discover",
  "/projects",
  "/studio",
  "/queue",
  "/calendar",
  "/marketing",
  "/workflows",
];

export function RoutePrefetch() {
  const router = useRouter();

  useEffect(() => {
    KEY_ROUTES.forEach((route) => router.prefetch(route));
  }, [router]);

  return null;
}
