import { z } from "zod";

import {
  protectedProcedure,
  createTRPCRouter,
} from "@/server/api/trpc";
import { getUserIdFromEmail } from "./apiMethods";

export const memberMethods = {
  getSelf: protectedProcedure.query(async ({ ctx }) => {
    await ctx.db.user.findUnique({
      where: {
        id: ctx.session.user.id
      }
    })
  }),
  createTeam: protectedProcedure.input(z.object({
    email: z.string().email().optional(),
    userId: z.string().min(16).optional(),
    organisationId: z.string().min(1),
    teamName: z.string().min(1),
  }))
  .mutation(async ({ ctx, input: { userId, email, organisationId, teamName } }) => {
    // cannot use simple Prisma insert as has to be inserted into both statements at once
    if (email) {
      userId = userId ?? await getUserIdFromEmail(ctx, email, "manager");
    }
  
    if (userId) {
      await ctx.db.$transaction([
        // extension doesn't work for $executeRaw!
        ctx.db.$queryRaw`SELECT set_config('app.current_user_id', ${ctx.session.user.id}, TRUE);`,
        ctx.db.$executeRaw`WITH ins_meeting AS (
          INSERT INTO everday.team
                  (id, "organisationId", name, "primaryManagerId")
          VALUES (gen_random_uuid(), ${organisationId}, ${teamName}, ${userId ?? ctx.session.user.id})
          RETURNING id, "primaryManagerId"
          )
        INSERT INTO everday."_TeamManagers" ("A", "B")
        SELECT id, "primaryManagerId"
        FROM   ins_meeting;`
      ]);
    }
  }),
};

export const memberRouter = createTRPCRouter({
  createTeam: memberMethods.createTeam,
  getSelf: memberMethods.getSelf,
});
