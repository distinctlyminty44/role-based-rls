import { PrismaAdapter } from "@auth/prisma-adapter";
import {
  getServerSession,
  type DefaultSession,
  type NextAuthOptions,
} from "next-auth";
import { type Adapter } from "next-auth/adapters";
import GoogleProvider, { type GoogleProfile } from "next-auth/providers/google";

import { env } from "@/env";
import { db } from "@/server/db";
import { bypassRLS } from "./api/trpc";

type UserRole = "platform" | "owner" | "manager" | "member";

const getRole = async (profile: GoogleProfile): Promise<UserRole> => {

  const user = await db.user.findUnique({
    where: {
      id: profile.sub,
    }
  })
  if (user) {
    return user.role as UserRole;
  }

  const temporaryUser = await db.user.findUnique({
    where: {
      email: `TEMPORARY_${profile.email}`,
    }
  })

  if (temporaryUser) {
    return temporaryUser.role as UserRole;
  }

  return "member";
};

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      role: UserRole;
    } & DefaultSession["user"];
  }

  interface User {
    role: UserRole;
    given_name?: string,
    family_name?: string,
  }
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  callbacks: {
    jwt: async ({ token, user, trigger }) => {

      if (trigger === 'update' && token.sub) {
        const role = await getRole({ sub: token.sub } as GoogleProfile);
        token.role = role ?? token.role;
      }
      
      /* For temporary users, transfer ownership of organisation to validated user from federated identity
       * This is required as NextAuth makes it difficult for an existing (invited) user to use a federated identity
       * NOTE: could do this with $extends(useRLS(user.id)) for the create and $extends(useRLS(temporaryUser.id)) for the delete
       */
      if (trigger === 'signUp' && ["owner", "manager"].includes(user.role)) {
        await db.$extends(bypassRLS()).$transaction(async (tx) => {
          const temporaryUser = await tx.user.findUnique({
            where: {
              email: `TEMPORARY_${user.email}`,
            },
            select: {
              id: true,
              role: true,
              Organisations: true,
              ownership: true,
            }
          })

          if (temporaryUser) {
            for (const organisation of temporaryUser?.Organisations ?? []) {
              await tx.organisation.update({
                where: {
                  id: organisation.id
                },
                data: {
                  owners: {
                    connect: { id: user.id }
                  },
                }
              });
              /* Prisma will try and update primaryOwnerId first if included in the above. Must be updated 
               * after the connect due to referential integrity constraint which ensures at least one 
               * organisation owner.
               */
              await tx.organisation.update({
                where: {
                  id: organisation.id,
                  primaryOwnerId: temporaryUser.id,
                },  
                data: {
                  primaryOwnerId: user.id,
                },
              });
              await tx.organisation.update({
                where: {
                  id: organisation.id
                },  
                data: {
                  owners: {
                    disconnect: { id: temporaryUser.id },
                  },
                }
              })
            }

            for (const team of temporaryUser?.ownership ?? []) {
              await tx.team.update({
                where: {
                  id: team.id
                },
                data: {
                  managers: {
                    connect: { id: user.id }
                  },
                }
              });
              await tx.team.update({
                where: {
                  id: team.id,
                  primaryManagerId: temporaryUser.id
                },  
                data: {
                  primaryManagerId: user.id,
                },
              });
              await tx.team.update({
                where: {
                  id: team.id
                },  
                data: {
                  managers: {
                    disconnect: { id: temporaryUser.id },
                  },
                }
              })
            }
            
            await tx.user.delete({ where: { id: temporaryUser.id }});
          }
        });
      }

      return {
        ...token,
        id: token.id ?? user.id,
        role: token.role ?? user?.role 
      }
    },
    session: ({ session, user, token }) => {
      user = user ?? { id: token.id, role: token.role ?? "member" };
      return ({
        ...session,
        user: {
          ...session.user,
          id: user.id,
          role: user.role,
        },
    })},
  },
  adapter: PrismaAdapter(db) as Adapter,
  providers: [
    GoogleProvider({
      clientId: env.GOOGLE_ID,
      clientSecret: env.GOOGLE_SECRET,
      profile: async (profile: GoogleProfile) => ({
          id: profile.sub,
          // given_name: profile.given_name,
          // family_name: profile.family_name,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
          role: await getRole(profile),
      }),
    })
  ],
};

/**
 * Wrapper for `getServerSession` so that you don't need to import the `authOptions` in every file.
 *
 * @see https://next-auth.js.org/configuration/nextjs
 */
export const getServerAuthSession = () => getServerSession(authOptions);
