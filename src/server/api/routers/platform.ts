import { z } from "zod";

import {
  createTRPCRouter,
  platformProcedure,
} from "@/server/api/trpc";
import { ownerMethods } from "./owner";
import { managerMethods } from "./manager";
import { memberMethods } from "./member";
import { getUserIdFromEmail } from "./apiMethods";

export const platformMethods = {
  createOrganisation: platformProcedure.input(
    z.object({
      organisationName: z.string(),
      email: z.string().email(),
      userId: z.string().min(16),
    })
    .partial()
    .refine(({ organisationName, email, userId }) => organisationName !== undefined && (email !== undefined || userId !== undefined ))
  )
  .mutation(async ({ ctx, input: { userId, email, organisationName } }) => {
    
    if (email) {
      userId = userId ?? await getUserIdFromEmail(ctx, email, "owner");
    }

    if (userId) {
      // cannot use simple Prisma insert as has to be inserted into both statements at once
      await ctx.db.$transaction([
        // extension doesn't work for $executeRaw!
        ctx.db.$queryRaw`SELECT set_config('app.current_user_id', ${ctx.session.user.id}, TRUE);`,
        ctx.db.$executeRaw`WITH ins_meeting AS (
          INSERT INTO everday.organisation
                  (id, name, "primaryOwnerId")
          VALUES (gen_random_uuid(), ${organisationName}, ${userId})
          RETURNING id, "primaryOwnerId"
          )
        INSERT INTO everday."_OrganisationOwners" ("A", "B")
        SELECT id, "primaryOwnerId"
        FROM   ins_meeting;`
      ])
    }
  }),
}

export const platformRouter = createTRPCRouter({
  ...ownerMethods,
  ...managerMethods,
  ...memberMethods,
  createOrganisation: platformMethods.createOrganisation,
});
