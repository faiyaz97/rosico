import { ButtonLink, EmptyState } from "@/components/ui";

export default function NotFoundPage() {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "12vh 20px" }}>
      <EmptyState
        title="This page is unavailable"
        description="It may have been removed, or you may not have access to its group."
        action={<ButtonLink href="/app">Back to Rosica</ButtonLink>}
      />
    </main>
  );
}
