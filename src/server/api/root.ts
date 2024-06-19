import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";
import { platformRouter } from "./routers/platform";
import { ownerRouter } from "./routers/owner";
import { managerRouter } from "./routers/manager";
import { memberRouter } from "./routers/member";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  platform: platformRouter,
  owner: ownerRouter,
  manager: managerRouter,
  member: memberRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
