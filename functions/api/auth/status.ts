import { handleStatus } from "../../../server/auth/handlers";
import type { AuthEnv } from "../../../server/auth/core";

export const onRequestGet = (ctx: { request: Request; env: AuthEnv }) => handleStatus(ctx.env, ctx.request);
