import type { Metadata } from "next";
import { OwnerPage } from "@/components/nr/owner";
export const metadata:Metadata={title:"Agenda del dueño",robots:{index:false,follow:false}};
export default function Page(){return <OwnerPage/>;}
