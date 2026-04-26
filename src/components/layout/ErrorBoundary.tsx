"use client";

import type { ReactNode } from "react";

type ErrorBoundaryProps = {
  children: ReactNode;
};

export function ErrorBoundary({ children }: ErrorBoundaryProps) {
  return <>{children}</>;
}
