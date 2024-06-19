import type { inferProcedureBuilderResolverOptions } from "@trpc/server";

import type { UserRole } from "@prisma/client";
import { db } from "@/server/db";
import { bypassRLS, type protectedProcedure } from "../trpc";

type Context = inferProcedureBuilderResolverOptions<typeof protectedProcedure>['ctx'];

export const getUserIdFromEmail = async (ctx: Context, email: string, role: UserRole) => {
  const existingUser = await db.$extends(bypassRLS()).user.findFirst({
    where: {
      OR: [{ email }, { email: `TEMPORARY_${email}` }]
    }
  });

  if (existingUser) {
    return existingUser.id
  }
  
  const temporaryUser = await db.$extends(bypassRLS()).user.create({
    data: {
      email: `TEMPORARY_${email}`,
      name: email,
      role,
      createdById: ctx.session.user.id,
    }
  }).catch((error) => console.log(error));
  return temporaryUser?.id;
}
