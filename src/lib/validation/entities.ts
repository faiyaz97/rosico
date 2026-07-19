import { z } from "zod";

const id = z.uuid();
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .optional();

export const groupInputSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: optionalText(500),
  isPublic: z.coerce.boolean().default(false)
});

export const invitationInputSchema = z.object({
  groupId: id,
  email: z.email().transform((email) => email.trim().toLowerCase())
});

export const playerInputSchema = z.object({
  groupId: id,
  playerId: id.optional(),
  displayName: z.string().trim().min(1).max(80)
});

export const customCompetitionInputSchema = z
  .object({
    groupId: id,
    name: z.string().trim().min(2).max(100),
    description: optionalText(500),
    allowsDraws: z.coerce.boolean(),
    scoreType: z.enum(["NUMERIC", "ORDERED", "RESULT"]),
    winnerDirection: z.enum(["HIGHER_WINS", "LOWER_WINS"]),
    orderedValues: z
      .array(z.string().trim().min(1).max(40))
      .max(64)
      .default([]),
    formats: z
      .array(
        z.object({
          label: z.string().trim().min(1).max(40),
          playersPerSide: z.coerce.number().int().min(1).max(20)
        })
      )
      .min(1)
      .max(10)
  })
  .superRefine((value, context) => {
    if (
      value.scoreType === "ORDERED" &&
      (value.orderedValues.length < 2 ||
        new Set(value.orderedValues).size !== value.orderedValues.length)
    ) {
      context.addIssue({
        code: "custom",
        path: ["orderedValues"],
        message: "Ordered scoring requires at least two unique values."
      });
    }
    const teamSizes = value.formats.map((format) => format.playersPerSide);
    if (new Set(teamSizes).size !== teamSizes.length) {
      context.addIssue({
        code: "custom",
        path: ["formats"],
        message: "Each team size can only be selected once."
      });
    }
  });

export const competitionConfigurationInputSchema = z
  .object({
    groupId: id,
    competitionId: id,
    allowsDraws: z.coerce.boolean(),
    scoreType: z.enum(["NUMERIC", "ORDERED", "RESULT"]),
    winnerDirection: z.enum(["HIGHER_WINS", "LOWER_WINS"]),
    orderedValues: z
      .array(z.string().trim().min(1).max(40))
      .max(64)
      .default([]),
    formats: z
      .array(
        z.object({
          label: z.string().trim().min(1).max(40),
          playersPerSide: z.coerce.number().int().min(1).max(20)
        })
      )
      .min(1)
      .max(10)
  })
  .superRefine((value, context) => {
    if (
      value.scoreType === "ORDERED" &&
      (value.orderedValues.length < 2 ||
        new Set(value.orderedValues).size !== value.orderedValues.length)
    ) {
      context.addIssue({
        code: "custom",
        path: ["orderedValues"],
        message: "Ordered scoring requires at least two unique values."
      });
    }
    const teamSizes = value.formats.map((format) => format.playersPerSide);
    if (new Set(teamSizes).size !== teamSizes.length) {
      context.addIssue({
        code: "custom",
        path: ["formats"],
        message: "Each team size can only be selected once."
      });
    }
  });

export const gameInputSchema = z
  .object({
    groupId: id,
    competitionId: id,
    formatId: id,
    sideAPlayerIds: z.array(id).min(1).max(20),
    sideBPlayerIds: z.array(id).min(1).max(20),
    scoreA: z.string().trim().min(1).max(40).optional(),
    scoreB: z.string().trim().min(1).max(40).optional(),
    result: z.enum(["A", "B", "DRAW"]).optional(),
    playedAt: z.coerce.date().optional(),
    location: optionalText(160),
    tournamentMatchId: id.optional()
  })
  .superRefine((value, context) => {
    const hasScores = value.scoreA !== undefined || value.scoreB !== undefined;
    if (value.result && hasScores) {
      context.addIssue({
        code: "custom",
        path: ["result"],
        message: "Submit either a result or scores, not both."
      });
    }
    if (
      !value.result &&
      (value.scoreA === undefined || value.scoreB === undefined)
    ) {
      context.addIssue({
        code: "custom",
        path: ["scoreA"],
        message: "A score is required for each side."
      });
    }
  });

export const tournamentInputSchema = z
  .object({
    groupId: id,
    competitionId: id,
    formatId: id,
    name: z.string().trim().min(2).max(120),
    type: z.enum(["ELIMINATION", "LEAGUE"]),
    startsAt: z.coerce.date(),
    bestOf: z.coerce.number().int().positive().max(99).optional(),
    winPoints: z.coerce.number().int().optional(),
    drawPoints: z.coerce.number().int().optional(),
    lossPoints: z.coerce.number().int().optional(),
    entries: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(120),
          playerIds: z.array(id).min(1).max(20)
        })
      )
      .min(2)
      .max(128)
  })
  .superRefine((value, context) => {
    if (
      value.type === "ELIMINATION" &&
      (!value.bestOf || value.bestOf % 2 === 0)
    ) {
      context.addIssue({
        code: "custom",
        path: ["bestOf"],
        message: "Best-of must be a positive odd number."
      });
    }
    if (
      value.type === "LEAGUE" &&
      (value.winPoints === undefined || value.lossPoints === undefined)
    ) {
      context.addIssue({
        code: "custom",
        path: ["winPoints"],
        message: "League points are required."
      });
    }
  });

export function formDataToObject(formData: FormData) {
  return Object.fromEntries(
    [...formData.entries()].map(([key, value]) => [key, String(value)])
  );
}
