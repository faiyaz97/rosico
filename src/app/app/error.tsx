"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui";

export default function AppError({
  error
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="app-content">
      <ErrorState />
    </div>
  );
}
