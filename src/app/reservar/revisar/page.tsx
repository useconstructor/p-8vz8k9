import type { Metadata } from "next";
import { ReviewPage } from "@/components/nr/reservation";
export const metadata:Metadata={title:"Revisar reserva",robots:{index:false,follow:false}};
export default function Page(){return <ReviewPage/>;}
