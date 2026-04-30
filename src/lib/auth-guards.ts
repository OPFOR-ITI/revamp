import { redirect } from "next/navigation";

import { api } from "../../convex/_generated/api";
import {
  getDefaultAuthorizedPath,
  hasPermission,
  type AppPermission,
} from "@/lib/access-control";
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
    redirect(getDefaultAuthorizedPath(user.roles) ?? "/pending-approval");
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

export async function requireApprovedUserWithPermission(
  permission: AppPermission,
) {
  const user = await requireApprovedUser();

  if (!hasPermission(user.roles, permission)) {
    redirect(getDefaultAuthorizedPath(user.roles) ?? "/");
  }

  return user;
}

export async function requireAdminUser() {
  return await requireApprovedUserWithPermission("userManagement.manage");
}
