import { handleStatus } from "../../../server/auth/handlers";
import type { AuthEnv } from "../../../server/auth/core";

export const onRequestGet = (ctx: { env: AuthEnv }) => handleStatus(ctx.env);
