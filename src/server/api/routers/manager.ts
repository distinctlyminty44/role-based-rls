import { z } from "zod";

import {
  createTRPCRouter,
  managerProcedure,
} from "@/server/api/trpc";
import { getUserIdFromEmail } from "./apiMethods";
import { memberMethods } from "./member";

export const managerMethods = {
  inviteTeamUser: managerProcedure.input(
    z.object({
      teamId: z.string(),
      email: z.string().email(),
      userId: z.string().min(16),
      userType: z.enum(["managers", "members"]),
    })
    .partial()
    .refine(({ teamId, email, userId }) => teamId !== undefined && (email !== undefined || userId !== undefined ))
  )
  .mutation(async ({ ctx, input: { userType, teamId, email, userId } }) => {
    if (email) {
      userId = userId ?? await getUserIdFromEmail(ctx, email, "member");
    }

    if (userId) {
      await ctx.db.team.update({
        where: {
          id: teamId,
          managers: ctx.session.user.role === "platform" ? {} : {
            some: {
              id: ctx.session.user.id
            }
          }
        },
        data: {
          [userType as string]: {
            connect: [{ id: userId }]
          }
        }
      })
    }
  }),
  listTeams: managerProcedure.query(async ({ ctx }) => await ctx.db.team.findMany({
    where: ctx.session.user.role === "platform" ? {} : {
      managers: {
        some: {
          id: ctx.session.user.id
        }
      }
    },
    include: {
        managers: true,
        members: true,
    },
  })),
  getUser: managerProcedure
    .input(z.object({
      userId: z.string(),
    }))
    .query(async ({ ctx, input: { userId } }) => {
      await ctx.db.user.findUnique({
        where: {
          id: userId,
        }
      })
    }),
}

export const managerRouter = createTRPCRouter({
  ...memberMethods,
  inviteTeamUser: managerMethods.inviteTeamUser,
  listTeams: managerMethods.listTeams,
  getUser: managerMethods.getUser,
});
