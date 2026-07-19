import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, groups } from "@/db";
import { createGroup } from "@/lib/server/groups";
import {
  deletePrivateImage,
  normaliseImage,
  uploadPrivateImage
} from "@/lib/media/images";
import { Field, FormActions, PageHeader, UploadField } from "@/components/ui";

export const metadata = { title: "Create group" };

export default function CreateGroupPage() {
  async function create(formData: FormData) {
    "use server";
    const file = formData.get("image");
    const hasImage = file instanceof File && file.size > 0;
    if (hasImage) await normaliseImage(file);

    let group: Awaited<ReturnType<typeof createGroup>> | undefined;
    let uploadedPath: string | undefined;
    try {
      group = await createGroup({
        name: String(formData.get("name") ?? ""),
        description: String(formData.get("description") ?? "")
      });
      if (hasImage) {
        const image = await uploadPrivateImage("groups", group.id, file);
        uploadedPath = image.path;
        await getDb()
          .update(groups)
          .set({ imagePath: image.path })
          .where(eq(groups.id, group.id));
      }
    } catch (error) {
      if (group) {
        await getDb().delete(groups).where(eq(groups.id, group.id));
      }
      if (uploadedPath) {
        try {
          await deletePrivateImage(uploadedPath);
        } catch (cleanupError) {
          console.warn("Could not remove an unused group image.", cleanupError);
        }
      }
      throw error;
    }
    redirect(`/app/groups/${group.id}`);
  }
  return (
    <div className="app-content">
      <PageHeader
        backHref="/app/groups"
        backLabel="All groups"
        eyebrow="New group"
        title="Where will you compete?"
        description="You will become the first administrator. Add more administrators after creation."
      />
      <form className="form-shell" action={create}>
        <div className="step-list" aria-label="Step 1 of 1">
          <span className="active" />
        </div>
        <div className="form-section">
          <h2>Group details</h2>
          <p>Use a name your players will recognise.</p>
          <div className="field-row">
            <Field
              label="Group name"
              name="name"
              placeholder="Google Milano"
              required
            />
            <label className="field">
              <span>Description</span>
              <textarea
                name="description"
                placeholder="A short description of this group"
                maxLength={500}
              />
              <small>Optional - 500 characters maximum</small>
            </label>
            <UploadField label="Group image" />
          </div>
        </div>
        <FormActions submit="Create group" cancelHref="/app/groups" />
      </form>
    </div>
  );
}
