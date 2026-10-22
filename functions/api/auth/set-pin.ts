import { handleSetPin } from "../../../server/auth/handlers";
import type { AuthEnv } from "../../../server/auth/core";

export const onRequestPost = (ctx: { request: Request; env: AuthEnv }) => handleSetPin(ctx.request, ctx.env);
