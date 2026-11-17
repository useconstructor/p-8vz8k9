import type { Metadata } from "next";
import { PublicPage } from "@/components/nr/public-pages";
import branding from "../../branding.json";
export const metadata:Metadata={title:`Inicio · ${branding.logoText}`};
export default function Page(){return <PublicPage mode="home"/>;}
