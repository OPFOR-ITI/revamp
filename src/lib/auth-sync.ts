"use client";

import { authClient } from "@/lib/auth-client";

const RETRY_DELAYS_MS = [100, 250, 500, 1000];

function wait(delayMs: number) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

export async function syncCurrentUserAfterAuth<T>(
  syncCurrentUser: (args: Record<string, never>) => Promise<T>,
) {
  await authClient.getSession();

  let lastError: unknown;

  for (const delayMs of RETRY_DELAYS_MS) {
    const tokenResult = await authClient.convex.token({
      fetchOptions: {
        throw: false,
      },
    });

    if (tokenResult.data?.token) {
      try {
        return await syncCurrentUser({});
      } catch (error) {
        lastError = error;
      }
    } else {
      lastError =
        tokenResult.error ??
        new Error("Convex auth token was not available after authentication.");
    }

    await wait(delayMs);
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Unable to establish an authenticated Convex session.");
}
