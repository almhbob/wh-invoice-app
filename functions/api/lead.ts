import { handleLead, handleLeadConfig, type LeadEnv } from "../../server/leads";

export const onRequestPost = (ctx: { request: Request; env: LeadEnv }) => handleLead(ctx.request, ctx.env);
export const onRequestGet = (ctx: { env: LeadEnv }) => handleLeadConfig(ctx.env);
