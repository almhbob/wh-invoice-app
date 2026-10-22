import { handleCatalog } from "../../server/online";
import type { AuthEnv } from "../../server/auth/core";

export const onRequestGet = (ctx: { request: Request; env: AuthEnv }) => handleCatalog(ctx.request, ctx.env);
