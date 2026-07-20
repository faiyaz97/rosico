import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { ExternalLink, Mail, Trash2, UserPlus } from "lucide-react";
import { getDb, groups } from "@/db";
import { deletePrivateImage, uploadPrivateImage } from "@/lib/media/images";
import { requireGroupAdmin } from "@/lib/server/authorization";
import {
  cancelInvitation,
  getGroupSettings,
  inviteAdministrator,
  removeAdministrator
} from "@/lib/server/groups";
import {
  Field,
  FormActions,
  PageHeader,
  Section,
  Status,
  UploadField
} from "@/components/ui";

export default async function GroupSettingsPage({
  params
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const { group, members, invitations } = await getGroupSettings(groupId);

  async function update(formData: FormData) {
    "use server";
    await requireGroupAdmin(groupId);
    const name = String(formData.get("name") ?? "").trim();
    if (name.length < 2 || name.length > 100)
      throw new Error("Group names must be between 2 and 100 characters.");
    const description =
      String(formData.get("description") ?? "").trim() || null;
    const isPublic = formData.get("isPublic") === "on";
    let imagePath = group.imagePath;
    let uploadedPath: string | undefined;
    const file = formData.get("image");
    if (file instanceof File && file.size > 0) {
      uploadedPath = (await uploadPrivateImage("groups", groupId, file)).path;
      imagePath = uploadedPath;
    }
    try {
      await getDb()
        .update(groups)
        .set({ name, description, isPublic, imagePath, updatedAt: new Date() })
        .where(eq(groups.id, groupId));
    } catch (error) {
      if (uploadedPath) {
        try {
          await deletePrivateImage(uploadedPath);
        } catch (cleanupError) {
          console.warn("Could not remove an unused group image.", cleanupError);
        }
      }
      throw error;
    }
    if (imagePath !== group.imagePath && group.imagePath) {
      try {
        await deletePrivateImage(group.imagePath);
      } catch (cleanupError) {
        console.warn("Could not remove replaced group image.", cleanupError);
      }
    }
    revalidatePath(`/app/groups/${groupId}`, "layout");
  }

  async function invite(formData: FormData) {
    "use server";
    await inviteAdministrator({
      groupId,
      email: String(formData.get("email") ?? "")
    });
    revalidatePath(`/app/groups/${groupId}/settings`);
  }

  async function cancel(formData: FormData) {
    "use server";
    await cancelInvitation(groupId, String(formData.get("invitationId") ?? ""));
    revalidatePath(`/app/groups/${groupId}/settings`);
  }

  async function remove(formData: FormData) {
    "use server";
    await removeAdministrator(groupId, String(formData.get("userId") ?? ""));
    revalidatePath(`/app/groups/${groupId}/settings`);
  }

  return (
    <div className="app-content">
      <PageHeader
        backHref={`/app/groups/${groupId}`}
        backLabel="Group overview"
        title="Group settings"
        description="Only group administrators can view and change these settings."
      />
      <form className="form-shell" action={update}>
        <div className="form-section">
          <h2>Group details</h2>
          <p>Shown throughout Rosica and on shared result images.</p>
          <div className="field-row">
            <Field
              label="Name"
              name="name"
              defaultValue={group.name}
              required
            />
            <label className="field">
              <span>Description</span>
              <textarea
                name="description"
                defaultValue={group.description ?? ""}
              />
            </label>
            <UploadField label="Group image" />
            <label className="choice visibility-choice">
              <input
                type="checkbox"
                name="isPublic"
                defaultChecked={group.isPublic}
              />
              <span>
                <strong>Public group</strong>
                <small>
                  Anyone with the link can view players, competitions, results,
                  rankings and tournaments. Only administrators can make
                  changes.
                </small>
              </span>
            </label>
            {group.isPublic && (
              <Link
                className="text-link"
                href={`/app/groups/${groupId}`}
                target="_blank"
              >
                Open public view <ExternalLink size={15} />
              </Link>
            )}
          </div>
        </div>
        <FormActions />
      </form>

      <Section
        title="Administrators"
        description="All administrators have the same permissions."
      >
        <form className="surface surface-pad" action={invite}>
          <div className="field-row two">
            <Field
              label="Invite by email"
              name="email"
              type="email"
              placeholder="colleague@example.com"
              required
            />
            <div style={{ display: "flex", alignItems: "end" }}>
              <button className="button button-primary" type="submit">
                <UserPlus size={17} /> Add administrator
              </button>
            </div>
          </div>
        </form>
        <div className="entity-list" style={{ marginTop: 12 }}>
          {members.map((member) => (
            <div className="entity-row" key={member.userId}>
              <span className="avatar avatar-md avatar-green">
                {member.displayName
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((word) => word[0])
                  .join("")
                  .toUpperCase()}
              </span>
              <span className="entity-row-main">
                <b>{member.displayName}</b>
                <small>{member.email}</small>
              </span>
              <Status
                tone={member.userId === group.creatorId ? "warning" : "success"}
              >
                {member.userId === group.creatorId ? "Creator" : "Admin"}
              </Status>
              {members.length > 1 && (
                <form action={remove}>
                  <input type="hidden" name="userId" value={member.userId} />
                  <button
                    className="icon-link"
                    type="submit"
                    aria-label={`Remove ${member.displayName}`}
                  >
                    <Trash2 size={17} />
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Pending invitations"
        description="Invitations are accepted when the person registers with the invited email."
      >
        {invitations.length ? (
          <div className="entity-list">
            {invitations.map((invitation) => (
              <div className="entity-row" key={invitation.id}>
                <span className="competition-icon">
                  <Mail size={19} />
                </span>
                <span className="entity-row-main">
                  <b>{invitation.email}</b>
                  <small>
                    Sent{" "}
                    {new Intl.DateTimeFormat("en-GB", {
                      dateStyle: "medium"
                    }).format(invitation.createdAt)}
                  </small>
                </span>
                <Status tone="warning">Pending</Status>
                <form action={cancel}>
                  <input
                    type="hidden"
                    name="invitationId"
                    value={invitation.id}
                  />
                  <button className="button button-quiet" type="submit">
                    Cancel
                  </button>
                </form>
              </div>
            ))}
          </div>
        ) : (
          <p className="active-period">No pending invitations.</p>
        )}
      </Section>
    </div>
  );
}
