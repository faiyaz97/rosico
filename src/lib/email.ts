import "server-only";

import { createHash } from "node:crypto";

import { Resend } from "resend";

import { serverEnv } from "@/lib/env";

type InvitationEmail = {
  invitationId: string;
  to: string;
  groupName: string;
  inviterName: string;
};

export async function sendInvitationEmail(input: InvitationEmail) {
  const env = serverEnv();
  const signupUrl = new URL("/register", env.NEXT_PUBLIC_APP_URL);
  signupUrl.searchParams.set("email", input.to);

  if (!env.RESEND_API_KEY) {
    console.info("[Rosica email preview]", {
      to: input.to,
      group: input.groupName,
      url: signupUrl.toString()
    });
    return { delivered: false as const, previewUrl: signupUrl.toString() };
  }

  const resend = new Resend(env.RESEND_API_KEY);
  const { error } = await resend.emails.send(
    {
      from: env.EMAIL_FROM,
      to: input.to,
      subject: `${input.inviterName} invited you to ${input.groupName} on Rosica`,
      text: `Create or sign in to your Rosica account with ${input.to}, then accept the invitation: ${signupUrl.toString()}`,
      html: `<p><strong>${escapeHtml(input.inviterName)}</strong> invited you to <strong>${escapeHtml(input.groupName)}</strong> on Rosica.</p><p><a href="${signupUrl.toString()}">Open Rosica</a> using ${escapeHtml(input.to)} to accept.</p>`
    },
    {
      idempotencyKey: `group-invitation/${createHash("sha256")
        .update(input.invitationId)
        .digest("base64url")}`
    }
  );

  if (error) {
    throw new Error(
      "The invitation was saved, but the email could not be sent."
    );
  }
  return { delivered: true as const, previewUrl: null };
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      })[character] ?? character
  );
}
