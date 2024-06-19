import { getServerAuthSession } from "../auth";

export const PlatformComponent = async (props: { children: React.ReactNode }) => {
  const session = await getServerAuthSession();
  if(session?.user.role === "platform") {
    return <>{props.children}</>;
  }
  return null;
};

export const OwnerComponent = async (props: { organisation?: string, children: React.ReactNode }) => {
  const session = await getServerAuthSession();
  if(session?.user.role === "owner") {
    return <>{props.children}</>;
  }
  return null;
};

export const ManagerComponent = async (props: { children: React.ReactNode }) => {
  const session = await getServerAuthSession();
  if(session?.user.role === "manager") {
    return <>{props.children}</>;
  }
  return null;
};

export const MemberComponent = async (props: { children: React.ReactNode }) => {
  const session = await getServerAuthSession();
  if(session?.user.role === "member") {
    return <>{props.children}</>;
  }
  return null;
};