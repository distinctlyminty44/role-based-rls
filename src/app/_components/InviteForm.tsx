"use client"

import { api } from "@/trpc/react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react"

type InviteFormProps = {
  type: "create-org" | "create-team" | "create-own-team" | "add-user" | "add-team-user" | "add-team-manager";
  addTo?: string;
}

const InviteForm = ({ type, addTo }: InviteFormProps) => {
  const router = useRouter();
  const [email, setEmail] = useState<string>();
  const [name, setName] = useState<string>();

  const onSuccess = useCallback(() => {
    setName("");
    setEmail("");
    router.refresh();
  }, [router])

  const createOrganisation = api.platform.createOrganisation.useMutation({
    onSuccess,
    onError: (error) => console.log(error),
  });

  const createTeam = api.platform.createTeam.useMutation({
    onSuccess,
    onError: (error) => console.log(error),
  });

  // const createUser = api.post.create.useMutation();

  const addToOrganisation = api.owner.inviteOrganisationOwner.useMutation({
    onSuccess,
    onError: (error) => console.log(error),
  })

  const addToTeam = api.manager.inviteTeamUser.useMutation({
    onSuccess,
    onError: (error) => console.log(error),
  });

  const submit = () => {
    // createUser.mutate({ name: "hello" });
    if (type === "create-org" && email && name) {
      createOrganisation.mutate({ email, organisationName: name });
      return;
    }
    if (type === "create-team" && email && name && addTo) {
      createTeam.mutate({ email, organisationId: addTo, teamName: name });
      return;
    }
    if (type === "create-own-team" && name && addTo) {
      createTeam.mutate({ organisationId: addTo, teamName: name });
      return;
    }
    if (type === "add-user" && email) {
      addToOrganisation.mutate({ email, organisationId: addTo })
      return;
    }
    if (type === "add-team-manager" && email) {
      addToTeam.mutate({ userType: "managers", email, teamId: addTo })
      return;
    }
    if (type === "add-team-user" && email) {
      addToTeam.mutate({ userType: "members", email, teamId: addTo })
      return;
    }
  };

  return <div className="flex flex-col text-black gap-2">
    {!["add-user", "add-team-user", "add-team-manager"].includes(type) && <input placeholder={`Enter ${addTo ? "new team" : "organisation"} name`} className="p-2 rounded-lg shadow-inner shadow-blue-500/20" onChange={(e) => setName(e.target.value)} value={name} />}
    {["add-user", "add-team-user", "add-team-manager", "create-team", "create-org"].includes(type) && <input placeholder="Enter email address" className="p-2 rounded-lg shadow-inner shadow-blue-500/20" onChange={(e) => setEmail(e.target.value)} value={email} />}    
    <button className="bg-white rounded-lg opacity-50 p-1 shadow-md shadow-blue-500/20" onClick={submit}>Submit</button>
  </div>
};

export default InviteForm;
