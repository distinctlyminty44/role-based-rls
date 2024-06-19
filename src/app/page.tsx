import Link from "next/link";

import { getServerAuthSession } from "@/server/auth";
import { api } from "@/trpc/server";
import { ManagerComponent, MemberComponent, OwnerComponent, PlatformComponent } from "@/server/auth/roles";
import InviteForm from "./_components/InviteForm";
import RefreshSession from "./_components/RefreshSession";
import type { Prisma } from "@prisma/client";

const OrganisationList = async () => {
  const organisations = await api.owner.listOrganisations();
  
  return <div className="flex flex-col opacity-90 bg-white text-black gap-4 m-4 p-4 rounded-lg shadow-md shadow-blue-500/20">{
    organisations.map(
      (organisation: typeof organisations[number]) => <div key={`org-${organisation.id}`}>
        <h1 className="text-2xl">
          {organisation.name}
        </h1>
        <h2 className="text-lg">Organisation Owners</h2>
        <div className="pl-4">{organisation.owners.map((owner) => <div className="text-sm" key={`owner-${owner.id}`}>{owner.name}</div>)}</div>
        <InviteForm addTo={organisation.id} type="add-user" />
        <TeamListView teams={organisation.teams} />
        <InviteForm addTo={organisation.id} type="create-team" />
      </div>
    )}</div>
}

type TeamReturn = Prisma.TeamGetPayload<{
  include: {
    managers: true,
    members: true,
  }
}>;

const TeamListView = ({ teams }: { teams: TeamReturn[] }) => (
  <>
    <h2 className="text-lg">Teams</h2>
    <div className="pl-4">{teams.map((team) => <div key={`team-${team.id}`}>
      <div className="text-sm" key={`team-${team.id}`}>{team.name}</div>

      <div className="pl-4">
        <h3 className="text-sm">Managers</h3>
        <div className="pl-4">
          {team.managers.map((manager) => <div className="text-xs" key={`manager-${manager.id}`}>{manager.name}</div>)}
        </div>
        <InviteForm type="add-team-manager" addTo={team.id} />
      </div>
      <div className="pl-4">
        <h3 className="text-sm">Members</h3>
        {team.members.length > 0 && <div className="pl-4">
          {team.members.map((member) => <div className="text-xs" key={`member-${member.id}`}>{member.name}</div>)}
        </div>}
        <InviteForm type="add-team-user" addTo={team.id} />
      </div>
      
    </div>)}</div>
    {/* <InviteForm addTo={organisation.id} type="create-team" /> */}
  </>
);

const TeamList = async () => {
  const teams = await api.manager.listTeams();
  
  return (
    <div className="flex flex-col opacity-90 bg-white text-black gap-4 m-4 p-4 rounded-lg shadow-md shadow-blue-500/20">
      <TeamListView teams={teams} />
    </div>
  )
}

export default async function Home() {
  const session = await getServerAuthSession();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50">
      <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16 ">
        <div className="flex flex-col items-center gap-2">
          <PlatformComponent>
            <InviteForm type="create-org" />
            <OrganisationList/>
          </PlatformComponent>
          <OwnerComponent>
            <OrganisationList/>
          </OwnerComponent>
          <ManagerComponent>
            <TeamList/>
          </ManagerComponent>

          <div className="flex flex-col items-center justify-center gap-4">
            <p className="text-center text-2xl">
              {session && <span>Logged in as {session.user?.name}</span>}
            </p>
            <Link
              href={session ? "/api/auth/signout" : "/api/auth/signin"}
              className="rounded-full bg-white/10 px-10 py-3 font-semibold no-underline transition hover:bg-white/20"
            >
              {session ? "Sign out" : "Sign in"}
            </Link>
            
            <MemberComponent>
              <RefreshSession />
            </MemberComponent>
            
          </div>
        </div>
      </div>
    </main>
  );
}
