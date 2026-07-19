import "server-only";

import { and, asc, desc, eq, isNull } from "drizzle-orm";

import {
  catalogueCompetitions,
  competitionFormats,
  competitionRuleVersions,
  getDb,
  groupCompetitions,
  orderedScoreValues
} from "@/db";
import {
  requireGroupAdmin,
  requireGroupViewer
} from "@/lib/server/authorization";
import { unavailable } from "@/lib/server/errors";
import {
  competitionConfigurationInputSchema,
  customCompetitionInputSchema
} from "@/lib/validation/entities";

export async function listCatalogue() {
  const db = getDb();
  return db
    .select()
    .from(catalogueCompetitions)
    .orderBy(asc(catalogueCompetitions.name));
}

export async function listCompetitions(
  groupId: string,
  includeArchived = false
) {
  const access = await requireGroupViewer(groupId);
  const showArchived = includeArchived && access.canManage;
  const db = getDb();
  return db
    .select()
    .from(groupCompetitions)
    .where(
      showArchived
        ? eq(groupCompetitions.groupId, groupId)
        : and(
            eq(groupCompetitions.groupId, groupId),
            isNull(groupCompetitions.archivedAt)
          )
    )
    .orderBy(asc(groupCompetitions.name));
}

export async function listGroupFormats(groupId: string) {
  const access = await requireGroupViewer(groupId);
  const db = getDb();
  return db
    .select({
      id: competitionFormats.id,
      label: competitionFormats.label,
      competitionId: competitionFormats.competitionId,
      competitionName: groupCompetitions.name
    })
    .from(competitionFormats)
    .innerJoin(
      groupCompetitions,
      and(
        eq(groupCompetitions.id, competitionFormats.competitionId),
        eq(groupCompetitions.groupId, competitionFormats.groupId)
      )
    )
    .where(
      and(
        eq(competitionFormats.groupId, groupId),
        access.canManage ? undefined : isNull(competitionFormats.archivedAt),
        access.canManage ? undefined : isNull(groupCompetitions.archivedAt)
      )
    )
    .orderBy(asc(groupCompetitions.name), asc(competitionFormats.sortOrder));
}

export async function addCatalogueCompetition(
  groupId: string,
  catalogueCompetitionId: string
) {
  const actor = await requireGroupAdmin(groupId);
  const db = getDb();
  return db.transaction(async (tx) => {
    const [catalogue] = await tx
      .select()
      .from(catalogueCompetitions)
      .where(eq(catalogueCompetitions.id, catalogueCompetitionId))
      .limit(1);
    if (!catalogue) throw unavailable();

    const [competition] = await tx
      .insert(groupCompetitions)
      .values({
        groupId,
        catalogueCompetitionId,
        name: catalogue.name,
        description: catalogue.description,
        imagePath: catalogue.imagePath
      })
      .returning();
    if (!competition) throw new Error("The competition could not be added.");

    const config = catalogue.defaultConfiguration;
    const [rule] = await tx
      .insert(competitionRuleVersions)
      .values({
        competitionId: competition.id,
        groupId,
        version: 1,
        allowsDraws: config.allowsDraws,
        scoreType: config.scoreType,
        winnerDirection: config.winnerDirection,
        createdById: actor.user.id
      })
      .returning();
    if (!rule) throw new Error("The competition rules could not be created.");

    if (config.scoreType === "ORDERED" && config.orderedValues?.length) {
      await tx.insert(orderedScoreValues).values(
        config.orderedValues.map((value, ordinal) => ({
          ruleVersionId: rule.id,
          value,
          ordinal
        }))
      );
    }
    await tx.insert(competitionFormats).values(
      config.formats.map((format, sortOrder) => ({
        competitionId: competition.id,
        groupId,
        label: format.label,
        playersPerSide: format.playersPerSide,
        sortOrder
      }))
    );
    return competition;
  });
}

export async function createCustomCompetition(input: unknown) {
  const data = customCompetitionInputSchema.parse(input);
  const actor = await requireGroupAdmin(data.groupId);
  const db = getDb();
  return db.transaction(async (tx) => {
    const [competition] = await tx
      .insert(groupCompetitions)
      .values({
        groupId: data.groupId,
        name: data.name,
        description: data.description
      })
      .returning();
    if (!competition) throw new Error("The competition could not be created.");

    const [rule] = await tx
      .insert(competitionRuleVersions)
      .values({
        competitionId: competition.id,
        groupId: data.groupId,
        version: 1,
        allowsDraws: data.allowsDraws,
        scoreType: data.scoreType,
        winnerDirection: data.winnerDirection,
        createdById: actor.user.id
      })
      .returning();
    if (!rule) throw new Error("The competition rules could not be created.");

    if (data.scoreType === "ORDERED") {
      await tx.insert(orderedScoreValues).values(
        data.orderedValues.map((value, ordinal) => ({
          ruleVersionId: rule.id,
          value,
          ordinal
        }))
      );
    }
    await tx.insert(competitionFormats).values(
      data.formats.map((format, sortOrder) => ({
        competitionId: competition.id,
        groupId: data.groupId,
        label: format.label,
        playersPerSide: format.playersPerSide,
        sortOrder
      }))
    );
    return competition;
  });
}

export async function setCompetitionArchived(
  groupId: string,
  competitionId: string,
  archived: boolean
) {
  await requireGroupAdmin(groupId);
  const db = getDb();
  const [competition] = await db
    .update(groupCompetitions)
    .set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() })
    .where(
      and(
        eq(groupCompetitions.id, competitionId),
        eq(groupCompetitions.groupId, groupId)
      )
    )
    .returning();
  if (!competition) throw unavailable();
  return competition;
}

export async function updateCompetitionConfiguration(input: unknown) {
  const data = competitionConfigurationInputSchema.parse(input);
  const actor = await requireGroupAdmin(data.groupId);
  const db = getDb();

  return db.transaction(async (tx) => {
    const [competition] = await tx
      .select({ id: groupCompetitions.id })
      .from(groupCompetitions)
      .where(
        and(
          eq(groupCompetitions.id, data.competitionId),
          eq(groupCompetitions.groupId, data.groupId),
          isNull(groupCompetitions.archivedAt)
        )
      )
      .for("update")
      .limit(1);
    if (!competition) throw unavailable();

    const [latestRule] = await tx
      .select({ version: competitionRuleVersions.version })
      .from(competitionRuleVersions)
      .where(
        and(
          eq(competitionRuleVersions.competitionId, data.competitionId),
          eq(competitionRuleVersions.groupId, data.groupId)
        )
      )
      .orderBy(desc(competitionRuleVersions.version))
      .limit(1);

    const [newRule] = await tx
      .insert(competitionRuleVersions)
      .values({
        competitionId: data.competitionId,
        groupId: data.groupId,
        version: (latestRule?.version ?? 0) + 1,
        allowsDraws: data.allowsDraws,
        scoreType: data.scoreType,
        winnerDirection: data.winnerDirection,
        createdById: actor.user.id
      })
      .returning();
    if (!newRule)
      throw new Error("The competition rules could not be updated.");

    if (data.scoreType === "ORDERED") {
      await tx.insert(orderedScoreValues).values(
        data.orderedValues.map((value, ordinal) => ({
          ruleVersionId: newRule.id,
          value,
          ordinal
        }))
      );
    }

    const existingFormats = await tx
      .select()
      .from(competitionFormats)
      .where(
        and(
          eq(competitionFormats.competitionId, data.competitionId),
          eq(competitionFormats.groupId, data.groupId)
        )
      )
      .orderBy(asc(competitionFormats.sortOrder));
    const selectedSizes = new Set(
      data.formats.map((format) => format.playersPerSide)
    );

    for (const format of existingFormats) {
      const selected = selectedSizes.has(format.playersPerSide);
      await tx
        .update(competitionFormats)
        .set({
          archivedAt: selected ? null : (format.archivedAt ?? new Date()),
          updatedAt: new Date()
        })
        .where(
          and(
            eq(competitionFormats.id, format.id),
            eq(competitionFormats.groupId, data.groupId)
          )
        );
    }

    const existingSizes = new Set(
      existingFormats.map((format) => format.playersPerSide)
    );
    const missingFormats = data.formats.filter(
      (format) => !existingSizes.has(format.playersPerSide)
    );
    if (missingFormats.length) {
      await tx.insert(competitionFormats).values(
        missingFormats.map((format) => ({
          competitionId: data.competitionId,
          groupId: data.groupId,
          label: format.label,
          playersPerSide: format.playersPerSide,
          sortOrder: data.formats.findIndex(
            (candidate) => candidate.playersPerSide === format.playersPerSide
          )
        }))
      );
    }

    await tx
      .update(groupCompetitions)
      .set({
        currentRuleVersion: newRule.version,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(groupCompetitions.id, data.competitionId),
          eq(groupCompetitions.groupId, data.groupId)
        )
      );

    return newRule;
  });
}
