import type { Metadata } from "next";
import { BookingPage } from "@/components/nr/booking-form";
export const metadata:Metadata={title:"Reservar"};
export default function Page(){return <BookingPage/>;}
