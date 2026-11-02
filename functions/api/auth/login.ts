import { handleLogin } from "../../../server/auth/handlers";
import type { AuthEnv } from "../../../server/auth/core";

export const onRequestPost = (ctx: { request: Request; env: AuthEnv }) => handleLogin(ctx.request, ctx.env);
