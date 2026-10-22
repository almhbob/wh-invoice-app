import { handleTrack } from "../../server/track";
import type { AuthEnv } from "../../server/auth/core";

export const onRequestGet = (ctx: { request: Request; env: AuthEnv }) => handleTrack(ctx.request, ctx.env);
