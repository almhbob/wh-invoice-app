import { handleOnlineOrder } from "../../server/online";
import type { AuthEnv } from "../../server/auth/core";

export const onRequestPost = (ctx: { request: Request; env: AuthEnv }) => handleOnlineOrder(ctx.request, ctx.env);
