import { redirect } from "next/navigation";

import { api } from "../../convex/_generated/api";
import { fetchAuthQuery, isAuthenticated } from "@/lib/auth-server";

export async function getCurrentAppUserOrNull() {
  const signedIn = await isAuthenticated();

  if (!signedIn) {
    return null;
  }

  try {
    return await fetchAuthQuery(api.users.getMe, {});
  } catch {
    return null;
  }
}

export async function redirectIfSignedIn() {
  const user = await getCurrentAppUserOrNull();

  if (!user) {
    return null;
  }

  if (user.approvalStatus === "approved") {
    redirect("/");
  }

  redirect("/pending-approval");
}

export async function requireApprovedUser() {
  const signedIn = await isAuthenticated();

  if (!signedIn) {
    redirect("/sign-in");
  }

  const user = await fetchAuthQuery(api.users.getMe, {});

  if (user.approvalStatus !== "approved") {
    redirect("/pending-approval");
  }

  return user;
}

export async function requireAdminUser() {
  const user = await requireApprovedUser();

  if (user.role !== "admin") {
    redirect("/");
  }

  return user;
}
