import type { Metadata } from "next";
import { ConfirmationPage } from "@/components/nr/reservation";
export const metadata:Metadata={title:"Confirmación",robots:{index:false,follow:false}};
export default function Page(){return <ConfirmationPage/>;}
