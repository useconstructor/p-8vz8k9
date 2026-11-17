import { handleGet, handlePost } from "@/lib/server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = handleGet;
export const POST = handlePost;
