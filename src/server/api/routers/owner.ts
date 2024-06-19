import { z } from "zod";

import {
  createTRPCRouter,
  ownerProcedure,
} from "@/server/api/trpc";
import { getUserIdFromEmail } from "./apiMethods";
import { memberMethods } from "./member";
import { managerMethods } from "./manager";

export const ownerMethods = {
  inviteOrganisationOwner: ownerProcedure.input(
    z.object({
      organisationId: z.string(),
      email: z.string().email(),
      userId: z.string().min(16),
    })
    .partial()
    .refine(({ organisationId, email, userId }) => organisationId !== undefined && (email !== undefined || userId !== undefined ))
  )
  .mutation(async ({ ctx, input: { organisationId, email, userId } }) => {
    if (email) {
      userId = userId ?? await getUserIdFromEmail(ctx, email, "owner");
    }

    if (userId) {
      await ctx.db.organisation.update({
        where: {
          id: organisationId,
        },
        data: {
          owners: {
            connect: [{ id: userId }]
          }
        }
      })
    }
  }),
  listOrganisations: ownerProcedure.query(async ({ ctx }) => await ctx.db.organisation.findMany({
    where: ctx.session.user.role === "platform" ? {} : {
      OR: [{
        owners: {
          some: {
            id: ctx.session.user.id
          }
        }
      }]
    },
    include: {
      owners: true,
      teams: {
        include: {
          managers: true,
          members: true,
        }
      },
    }
  })),
}

export const ownerRouter = createTRPCRouter({
  ...memberMethods,
  ...managerMethods,
  listOrganisations: ownerMethods.listOrganisations,
  inviteOrganisationOwner: ownerMethods.inviteOrganisationOwner,
});
