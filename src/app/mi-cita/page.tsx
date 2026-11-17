import type { Metadata } from "next";
import { ManagePage } from "@/components/nr/manage";
export const metadata:Metadata={title:"Mi cita",robots:{index:false,follow:false}};
export default function Page(){return <ManagePage/>;}
