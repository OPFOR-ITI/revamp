import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";

import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { action } from "./_generated/server";
import authConfig from "./auth.config";

const siteUrl = process.env.SITE_URL!;

export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    baseURL: siteUrl,
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    plugins: [
      convex({
        authConfig,
        // Local dev often recreates BETTER_AUTH_SECRET; rotate stale keys instead
        // of leaving token generation wedged.
        jwksRotateOnTokenGenerationError: true,
      }),
    ],
  });
};

export const { getAuthUser } = authComponent.clientApi();

export const rotateKeysForDev = action({
  args: {},
  handler: async (ctx) => {
    if (process.env.CONVEX_DEPLOYMENT?.startsWith("prod:")) {
      throw new Error("Refusing to rotate Better Auth keys on a production deployment.");
    }

    const auth = createAuth(ctx);
    return await auth.api.rotateKeys();
  },
});
