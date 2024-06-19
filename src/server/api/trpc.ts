/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */

import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

import { getServerAuthSession } from "@/server/auth";
import { db } from "@/server/db";
import { Prisma } from "@prisma/client";

/** 
 * Row Level Security bypass Prisma Extension
 * Requires bypass policy to be set on database, similar to:
 * CREATE POLICY bypass_rls_policy ON "Table Name" USING (current_setting('app.bypass_rls', TRUE)::text = 'on');
 */
export const bypassRLS = () => Prisma.defineExtension((prisma) =>
    prisma.$extends({
      query: {
        $allModels: {
          async $allOperations({ args, query }) {
            const [, result] = await prisma.$transaction([
              prisma.$executeRaw`SELECT set_config('app.bypass_rls', 'on', TRUE)`,
              query(args),
            ]);
            return result;
          },
        },
      },
    })
  );

/** 
 * Row Level Security user_id Prisma extension
 * Requires table level security policies to be enabled
 */
export const useRLS = (userId: string) => Prisma.defineExtension((prisma) => 
  prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const [, result] = await prisma.$transaction([
            prisma.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, TRUE)`,
            query(args),
          ]);
          console.log('res', result)
          return result;
        },
      },
    },
  })
);

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */
export const createTRPCContext = async (opts: { headers: Headers }) => {
  const session = await getServerAuthSession();

  return {
    db,
    session,
    ...opts,
  };
};

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get typesafety on the frontend if your procedure fails due to validation
 * errors on the backend.
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * Create a server-side caller.
 *
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these a lot in the
 * "/src/server/api/routers" directory.
 */

/**
 * This is how you create new routers and sub-routers in your tRPC API.
 *
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Public (unauthenticated) procedure
 *
 * This is the base piece you use to build new queries and mutations on your tRPC API. It does not
 * guarantee that a user querying is authorized, but you can still access user session data if they
 * are logged in.
 */
export const publicProcedure = t.procedure;

/**
 * Protected (authenticated) procedure
 *
 * If you want a query or mutation to ONLY be accessible to logged in users, use this. It verifies
 * the session is valid and guarantees `ctx.session.user` is not null.
 *
 * @see https://trpc.io/docs/procedures
 */
export const protectedProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.session || !ctx.session.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return next({
    ctx: {
      // uses Row Level Security
      db: ctx.db.$extends(useRLS(ctx.session.user.id)),
      // infers the `session` as non-nullable
      session: { ...ctx.session, user: ctx.session.user },
    },
  });
});

/**
 * Super-powered (authenticated) procedure bypassing Row Level Security controls. 
 *
 * Included for completeness, there should not be a reason to use this
 */
export const bypassProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session || !ctx.session.user || ctx.session.user.role !== "platform") {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      // bypasses all Row Level Security in the database
      db: ctx.db.$extends(bypassRLS()),
      // infers the `session` as non-nullable
      session: { ...ctx.session, user: ctx.session.user },
    },
  });
});

export const platformProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.session.user.role !== "platform") {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next();
});

export const ownerProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!["platform", "owner"].includes(ctx.session.user.role)) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next();
});

export const managerProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!["platform", "owner", "manager"].includes(ctx.session.user.role)) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next();
});
