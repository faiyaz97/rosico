import { Mail } from "lucide-react";

import { acceptInvitationAction } from "@/app/actions/entities";
import { EmptyState, PageHeader, Section } from "@/components/ui";
import { listPendingInvitationsForActor } from "@/lib/server/groups";

export const metadata = { title: "Invitations" };

export default async function InvitationsPage() {
  const invitations = await listPendingInvitationsForActor();

  return (
    <div className="app-content">
      <PageHeader
        eyebrow="Your account"
        title="Group invitations"
        description="Accept invitations sent to your verified account email."
      />
      <Section title="Pending invitations">
        {invitations.length ? (
          <div className="entity-list">
            {invitations.map((invitation) => (
              <div className="entity-row" key={invitation.id}>
                <span className="competition-icon">
                  <Mail aria-hidden="true" size={19} />
                </span>
                <span className="entity-row-main">
                  <b>{invitation.groupName}</b>
                  <small>
                    Invited by {invitation.invitedBy} on{" "}
                    {new Intl.DateTimeFormat("en-GB", {
                      dateStyle: "medium",
                      timeZone: "Europe/Rome"
                    }).format(invitation.createdAt)}
                  </small>
                </span>
                <form action={acceptInvitationAction}>
                  <input
                    name="invitationId"
                    type="hidden"
                    value={invitation.id}
                  />
                  <button className="button button-primary" type="submit">
                    Accept
                  </button>
                </form>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No pending invitations"
            description="Invitations sent to your verified email will appear here."
          />
        )}
      </Section>
    </div>
  );
}
