"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation";

const RefreshSession = () => {
  const { data: session, update } = useSession();
  const router = useRouter();

  const updateSession = async () => {
    const newSession = await update();
    if (session?.user.role !== newSession?.user.role) {
      router.refresh();
    }
  }

  return (
    <button onClick={updateSession}>Refresh</button>
  )
};

export default RefreshSession;