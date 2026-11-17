import type { Metadata } from "next";
import { PublicPage } from "@/components/nr/public-pages";
export const metadata:Metadata={title:"Visítanos"};
export default function Page(){return <PublicPage mode="visit"/>;}
