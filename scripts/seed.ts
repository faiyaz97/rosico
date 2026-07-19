import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

import { createClient } from "@supabase/supabase-js";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, desc, eq } from "drizzle-orm";
import postgres from "postgres";

import {
  catalogueCompetitions,
  competitionFormats,
  competitionRuleVersions,
  gameParticipants,
  games,
  groupCompetitions,
  groupMemberships,
  groups,
  orderedScoreValues,
  players,
  profiles,
  tournamentEntries,
  tournamentEntryPlayers,
  tournamentMatches,
  tournaments
} from "../src/db/schema";

if (existsSync(".env.local")) loadEnvFile(".env.local");

const databaseUrl = process.env.DATABASE_DIRECT_URL ?? process.env.DATABASE_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!databaseUrl || !supabaseUrl || !secretKey) {
  throw new Error(
    "DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, and SUPABASE_SECRET_KEY are required."
  );
}

const sql = postgres(databaseUrl, { max: 1 });
const db = drizzle(sql);
const supabase = createClient(supabaseUrl, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});
const demoPassword = "RosicaDemo!2026";
const demoUsers = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    email: "alex@rosica.test",
    displayName: "Alex Morgan"
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    email: "sam@rosica.test",
    displayName: "Sam Taylor"
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    email: "jordan@rosica.test",
    displayName: "Jordan Lee"
  }
];

const existingUsers = await supabase.auth.admin.listUsers({ perPage: 1000 });
if (existingUsers.error) throw existingUsers.error;
const userIds = new Map<string, string>();

for (const demo of demoUsers) {
  const existing = existingUsers.data.users.find(
    (user) => user.email?.toLowerCase() === demo.email
  );
  if (existing) {
    userIds.set(demo.email, existing.id);
    await supabase.auth.admin.updateUserById(existing.id, {
      password: demoPassword,
      email_confirm: true,
      user_metadata: { display_name: demo.displayName }
    });
  } else {
    const created = await supabase.auth.admin.createUser({
      id: demo.id,
      email: demo.email,
      password: demoPassword,
      email_confirm: true,
      user_metadata: { display_name: demo.displayName }
    });
    if (created.error || !created.data.user) throw created.error;
    userIds.set(demo.email, created.data.user.id);
  }
}

const alexId = requiredUser("alex@rosica.test");
const samId = requiredUser("sam@rosica.test");
const jordanId = requiredUser("jordan@rosica.test");

const ids = {
  groupMilano: "10000000-0000-4000-8000-000000000001",
  groupNavigli: "10000000-0000-4000-8000-000000000002",
  catalogueFootball: "20000000-0000-4000-8000-000000000001",
  catalogueTableTennis: "20000000-0000-4000-8000-000000000002",
  catalogueChess: "20000000-0000-4000-8000-000000000003",
  catalogueDarts: "20000000-0000-4000-8000-000000000004",
  catalogueBilliards: "20000000-0000-4000-8000-000000000005",
  football: "30000000-0000-4000-8000-000000000001",
  chess: "30000000-0000-4000-8000-000000000002",
  medal: "30000000-0000-4000-8000-000000000003",
  footballRule: "40000000-0000-4000-8000-000000000001",
  chessRule: "40000000-0000-4000-8000-000000000002",
  medalRule: "40000000-0000-4000-8000-000000000003",
  football1v1: "50000000-0000-4000-8000-000000000001",
  football2v2: "50000000-0000-4000-8000-000000000002",
  chess1v1: "50000000-0000-4000-8000-000000000003",
  medal1v1: "50000000-0000-4000-8000-000000000004",
  bracket: "70000000-0000-4000-8000-000000000001",
  league: "70000000-0000-4000-8000-000000000002"
};

const playerRows = [
  ["60000000-0000-4000-8000-000000000001", "Elena Rossi", null],
  ["60000000-0000-4000-8000-000000000002", "Marco Bianchi", null],
  ["60000000-0000-4000-8000-000000000003", "Sofia Conti", null],
  ["60000000-0000-4000-8000-000000000004", "Luca Romano", null],
  ["60000000-0000-4000-8000-000000000005", "Amina Farah", null],
  ["60000000-0000-4000-8000-000000000006", "Tom Greco", null],
  [
    "60000000-0000-4000-8000-000000000007",
    "Giulia Sala",
    new Date("2026-06-01T00:00:00Z")
  ]
] as const;

await db.transaction(async (tx) => {
  for (const demo of demoUsers) {
    await tx
      .insert(profiles)
      .values({
        id: requiredUser(demo.email),
        email: demo.email,
        displayName: demo.displayName
      })
      .onConflictDoUpdate({
        target: profiles.id,
        set: {
          email: demo.email,
          displayName: demo.displayName,
          updatedAt: new Date()
        }
      });
  }

  await tx
    .insert(groups)
    .values([
      {
        id: ids.groupMilano,
        name: "Google Milano",
        description: "Friendly office rivalries, settled properly.",
        isPublic: true,
        creatorId: alexId
      },
      {
        id: ids.groupNavigli,
        name: "Navigli Club",
        description: "Weekly games by the canal.",
        isPublic: false,
        creatorId: jordanId
      }
    ])
    .onConflictDoNothing();
  await tx
    .update(groups)
    .set({ isPublic: true, updatedAt: new Date() })
    .where(eq(groups.id, ids.groupMilano));
  await tx
    .update(groups)
    .set({ isPublic: false, updatedAt: new Date() })
    .where(eq(groups.id, ids.groupNavigli));
  await tx
    .insert(groupMemberships)
    .values([
      { groupId: ids.groupMilano, userId: alexId, addedById: alexId },
      { groupId: ids.groupMilano, userId: samId, addedById: alexId },
      { groupId: ids.groupNavigli, userId: jordanId, addedById: jordanId }
    ])
    .onConflictDoNothing();

  await tx
    .insert(catalogueCompetitions)
    .values([
      catalogue(
        ids.catalogueFootball,
        "table-football",
        "Table football",
        "Fast singles and doubles matches.",
        false,
        [
          { label: "1 vs 1", playersPerSide: 1 },
          { label: "2 vs 2", playersPerSide: 2 }
        ]
      ),
      catalogue(
        ids.catalogueTableTennis,
        "table-tennis",
        "Table tennis",
        "Singles and doubles table tennis.",
        false,
        [
          { label: "1 vs 1", playersPerSide: 1 },
          { label: "2 vs 2", playersPerSide: 2 }
        ]
      ),
      catalogue(
        ids.catalogueChess,
        "chess",
        "Chess",
        "Classic head-to-head chess.",
        true,
        [{ label: "1 vs 1", playersPerSide: 1 }],
        "RESULT"
      ),
      catalogue(
        ids.catalogueDarts,
        "darts",
        "Darts",
        "Leg-based darts matches.",
        false,
        [
          { label: "1 vs 1", playersPerSide: 1 },
          { label: "2 vs 2", playersPerSide: 2 }
        ]
      ),
      catalogue(
        ids.catalogueBilliards,
        "billiards",
        "Pool & billiards",
        "Rack-based pool and billiards.",
        false,
        [
          { label: "1 vs 1", playersPerSide: 1 },
          { label: "2 vs 2", playersPerSide: 2 }
        ]
      )
    ])
    .onConflictDoNothing();
  await tx
    .update(catalogueCompetitions)
    .set({
      defaultConfiguration: {
        allowsDraws: true,
        scoreType: "RESULT",
        winnerDirection: "HIGHER_WINS",
        formats: [{ label: "1 vs 1", playersPerSide: 1 }]
      }
    })
    .where(eq(catalogueCompetitions.id, ids.catalogueChess));

  await tx
    .insert(players)
    .values(
      playerRows.map(([id, displayName, archivedAt]) => ({
        id,
        groupId: ids.groupMilano,
        displayName,
        archivedAt
      }))
    )
    .onConflictDoNothing();

  await tx
    .insert(groupCompetitions)
    .values([
      {
        id: ids.football,
        groupId: ids.groupMilano,
        catalogueCompetitionId: ids.catalogueFootball,
        name: "Table football",
        description: "Singles and doubles on the office table."
      },
      {
        id: ids.chess,
        groupId: ids.groupMilano,
        catalogueCompetitionId: ids.catalogueChess,
        name: "Chess",
        description: "Quick games and lunchtime classics."
      },
      {
        id: ids.medal,
        groupId: ids.groupMilano,
        name: "Medal race",
        description: "A custom competition using ordered values."
      }
    ])
    .onConflictDoNothing();
  await tx
    .insert(competitionRuleVersions)
    .values([
      {
        id: ids.footballRule,
        competitionId: ids.football,
        groupId: ids.groupMilano,
        version: 1,
        allowsDraws: false,
        scoreType: "NUMERIC",
        winnerDirection: "HIGHER_WINS",
        createdById: alexId
      },
      {
        id: ids.chessRule,
        competitionId: ids.chess,
        groupId: ids.groupMilano,
        version: 1,
        allowsDraws: true,
        scoreType: "RESULT",
        winnerDirection: "HIGHER_WINS",
        createdById: alexId
      },
      {
        id: ids.medalRule,
        competitionId: ids.medal,
        groupId: ids.groupMilano,
        version: 1,
        allowsDraws: true,
        scoreType: "ORDERED",
        winnerDirection: "HIGHER_WINS",
        createdById: alexId
      }
    ])
    .onConflictDoNothing();
  const [seededChess] = await tx
    .select({ currentRuleVersion: groupCompetitions.currentRuleVersion })
    .from(groupCompetitions)
    .where(eq(groupCompetitions.id, ids.chess))
    .limit(1);
  if (!seededChess) throw new Error("The seeded Chess competition is missing.");
  const [currentChessRule] = await tx
    .select()
    .from(competitionRuleVersions)
    .where(
      and(
        eq(competitionRuleVersions.competitionId, ids.chess),
        eq(competitionRuleVersions.version, seededChess.currentRuleVersion)
      )
    )
    .limit(1);
  if (!currentChessRule) throw new Error("The seeded Chess rule is missing.");
  if (currentChessRule.scoreType !== "RESULT") {
    const [latestChessRule] = await tx
      .select({ version: competitionRuleVersions.version })
      .from(competitionRuleVersions)
      .where(eq(competitionRuleVersions.competitionId, ids.chess))
      .orderBy(desc(competitionRuleVersions.version))
      .limit(1);
    const [resultRule] = await tx
      .insert(competitionRuleVersions)
      .values({
        competitionId: ids.chess,
        groupId: ids.groupMilano,
        version: (latestChessRule?.version ?? currentChessRule.version) + 1,
        allowsDraws: true,
        scoreType: "RESULT",
        winnerDirection: "HIGHER_WINS",
        createdById: currentChessRule.createdById
      })
      .returning({ version: competitionRuleVersions.version });
    if (!resultRule)
      throw new Error("The Chess result rule could not be created.");
    await tx
      .update(groupCompetitions)
      .set({ currentRuleVersion: resultRule.version, updatedAt: new Date() })
      .where(eq(groupCompetitions.id, ids.chess));
  }
  await tx
    .insert(orderedScoreValues)
    .values(
      ["Bronze", "Silver", "Gold"].map((value, ordinal) => ({
        ruleVersionId: ids.medalRule,
        value,
        ordinal
      }))
    )
    .onConflictDoNothing();
  await tx
    .insert(competitionFormats)
    .values([
      {
        id: ids.football1v1,
        competitionId: ids.football,
        groupId: ids.groupMilano,
        label: "1 vs 1",
        playersPerSide: 1,
        sortOrder: 0
      },
      {
        id: ids.football2v2,
        competitionId: ids.football,
        groupId: ids.groupMilano,
        label: "2 vs 2",
        playersPerSide: 2,
        sortOrder: 1
      },
      {
        id: ids.chess1v1,
        competitionId: ids.chess,
        groupId: ids.groupMilano,
        label: "1 vs 1",
        playersPerSide: 1
      },
      {
        id: ids.medal1v1,
        competitionId: ids.medal,
        groupId: ids.groupMilano,
        label: "1 vs 1",
        playersPerSide: 1
      }
    ])
    .onConflictDoNothing();

  await insertGame(tx, {
    id: "80000000-0000-4000-8000-000000000001",
    competitionId: ids.football,
    formatId: ids.football1v1,
    ruleVersionId: ids.footballRule,
    scoreA: "10",
    scoreB: "8",
    outcome: "A",
    sideA: [playerRows[0][0]],
    sideB: [playerRows[1][0]],
    playedAt: new Date("2026-07-14T16:30:00Z")
  });
  await insertGame(tx, {
    id: "80000000-0000-4000-8000-000000000002",
    competitionId: ids.football,
    formatId: ids.football2v2,
    ruleVersionId: ids.footballRule,
    scoreA: "7",
    scoreB: "10",
    outcome: "B",
    sideA: [playerRows[0][0], playerRows[2][0]],
    sideB: [playerRows[1][0], playerRows[3][0]],
    playedAt: new Date("2026-07-15T17:10:00Z")
  });
  await insertGame(tx, {
    id: "80000000-0000-4000-8000-000000000003",
    competitionId: ids.medal,
    formatId: ids.medal1v1,
    ruleVersionId: ids.medalRule,
    scoreA: "Silver",
    scoreB: "Gold",
    comparableA: 1,
    comparableB: 2,
    outcome: "B",
    sideA: [playerRows[3][0]],
    sideB: [playerRows[2][0]],
    playedAt: new Date("2026-07-16T18:00:00Z")
  });

  await tx
    .insert(tournaments)
    .values([
      {
        id: ids.bracket,
        groupId: ids.groupMilano,
        competitionId: ids.football,
        formatId: ids.football1v1,
        ruleVersionId: ids.footballRule,
        name: "Summer knockout",
        type: "ELIMINATION",
        status: "ACTIVE",
        startsAt: new Date("2026-07-20T16:00:00Z"),
        bestOf: 3,
        createdById: alexId
      },
      {
        id: ids.league,
        groupId: ids.groupMilano,
        competitionId: ids.football,
        formatId: ids.football2v2,
        ruleVersionId: ids.footballRule,
        name: "Office league",
        type: "LEAGUE",
        status: "ACTIVE",
        startsAt: new Date("2026-07-21T16:00:00Z"),
        winPoints: 3,
        drawPoints: 1,
        lossPoints: 0,
        createdById: alexId
      }
    ])
    .onConflictDoNothing();

  const bracketEntries = playerRows
    .slice(0, 4)
    .map(([playerId, name], index) => ({
      id: `71000000-0000-4000-8000-00000000000${index + 1}`,
      tournamentId: ids.bracket,
      groupId: ids.groupMilano,
      name,
      seed: index + 1,
      playerId
    }));
  const leagueEntries = [
    {
      id: "72000000-0000-4000-8000-000000000001",
      name: "Elena & Sofia",
      playerIds: [playerRows[0][0], playerRows[2][0]]
    },
    {
      id: "72000000-0000-4000-8000-000000000002",
      name: "Marco & Luca",
      playerIds: [playerRows[1][0], playerRows[3][0]]
    },
    {
      id: "72000000-0000-4000-8000-000000000003",
      name: "Amina & Tom",
      playerIds: [playerRows[4][0], playerRows[5][0]]
    }
  ];
  await tx
    .insert(tournamentEntries)
    .values([
      ...bracketEntries.map((entry) => ({
        id: entry.id,
        tournamentId: entry.tournamentId,
        groupId: entry.groupId,
        name: entry.name,
        seed: entry.seed
      })),
      ...leagueEntries.map((entry, index) => ({
        id: entry.id,
        tournamentId: ids.league,
        groupId: ids.groupMilano,
        name: entry.name,
        seed: index + 1
      }))
    ])
    .onConflictDoNothing();
  await tx
    .insert(tournamentEntryPlayers)
    .values([
      ...bracketEntries.map((entry) => ({
        entryId: entry.id,
        tournamentId: ids.bracket,
        groupId: ids.groupMilano,
        playerId: entry.playerId,
        slot: 0
      })),
      ...leagueEntries.flatMap((entry) =>
        entry.playerIds.map((playerId, slot) => ({
          entryId: entry.id,
          tournamentId: ids.league,
          groupId: ids.groupMilano,
          playerId,
          slot
        }))
      )
    ])
    .onConflictDoNothing();
  await tx
    .insert(tournamentMatches)
    .values([
      {
        id: "73000000-0000-4000-8000-000000000001",
        tournamentId: ids.bracket,
        groupId: ids.groupMilano,
        round: 1,
        slot: 0,
        sideAEntryId: bracketEntries[0]!.id,
        sideBEntryId: bracketEntries[3]!.id,
        nextMatchId: "73000000-0000-4000-8000-000000000003",
        nextMatchSide: "A",
        status: "READY"
      },
      {
        id: "73000000-0000-4000-8000-000000000002",
        tournamentId: ids.bracket,
        groupId: ids.groupMilano,
        round: 1,
        slot: 1,
        sideAEntryId: bracketEntries[1]!.id,
        sideBEntryId: bracketEntries[2]!.id,
        nextMatchId: "73000000-0000-4000-8000-000000000003",
        nextMatchSide: "B",
        status: "READY"
      },
      {
        id: "73000000-0000-4000-8000-000000000003",
        tournamentId: ids.bracket,
        groupId: ids.groupMilano,
        round: 2,
        slot: 0,
        status: "PENDING"
      },
      ...(
        [
          [0, 1],
          [0, 2],
          [1, 2]
        ] as const
      ).map(([a, b], index) => ({
        id: `74000000-0000-4000-8000-00000000000${index + 1}`,
        tournamentId: ids.league,
        groupId: ids.groupMilano,
        round: index + 1,
        slot: 0,
        sideAEntryId: leagueEntries[a]!.id,
        sideBEntryId: leagueEntries[b]!.id,
        status: "READY" as const
      }))
    ])
    .onConflictDoNothing();
});

const bucket = await supabase.storage.getBucket("media");
if (bucket.error && bucket.error.message.toLowerCase().includes("not found")) {
  const created = await supabase.storage.createBucket("media", {
    public: false,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"]
  });
  if (created.error) throw created.error;
}

await sql.end();
console.info("Rosica demo data is ready.");
console.info(
  `Demo password for ${demoUsers.map((user) => user.email).join(", ")}: ${demoPassword}`
);

function requiredUser(email: string) {
  const id = userIds.get(email);
  if (!id) throw new Error(`Missing seeded user ${email}.`);
  return id;
}

function catalogue(
  id: string,
  slug: string,
  name: string,
  description: string,
  allowsDraws: boolean,
  formats: Array<{ label: string; playersPerSide: number }>,
  scoreType: "NUMERIC" | "RESULT" = "NUMERIC"
) {
  return {
    id,
    slug,
    name,
    description,
    defaultConfiguration: {
      allowsDraws,
      scoreType,
      winnerDirection: "HIGHER_WINS" as const,
      formats
    }
  };
}

async function insertGame(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  input: {
    id: string;
    competitionId: string;
    formatId: string;
    ruleVersionId: string;
    scoreA: string;
    scoreB: string;
    comparableA?: number;
    comparableB?: number;
    outcome: "A" | "B" | "DRAW";
    sideA: string[];
    sideB: string[];
    playedAt: Date;
  }
) {
  const comparableA = input.comparableA ?? Number(input.scoreA);
  const comparableB = input.comparableB ?? Number(input.scoreB);
  const inserted = await tx
    .insert(games)
    .values({
      id: input.id,
      groupId: ids.groupMilano,
      competitionId: input.competitionId,
      formatId: input.formatId,
      ruleVersionId: input.ruleVersionId,
      scoreA: input.scoreA,
      scoreB: input.scoreB,
      comparableScoreA: String(comparableA),
      comparableScoreB: String(comparableB),
      scoreDifference: String(comparableA - comparableB),
      outcome: input.outcome,
      playedAt: input.playedAt,
      createdById: alexId,
      updatedById: alexId
    })
    .onConflictDoNothing()
    .returning({ id: games.id });
  if (!inserted.length) return;
  await tx.insert(gameParticipants).values([
    ...input.sideA.map((playerId, slot) => ({
      gameId: input.id,
      groupId: ids.groupMilano,
      playerId,
      side: "A" as const,
      slot
    })),
    ...input.sideB.map((playerId, slot) => ({
      gameId: input.id,
      groupId: ids.groupMilano,
      playerId,
      side: "B" as const,
      slot
    }))
  ]);
}
