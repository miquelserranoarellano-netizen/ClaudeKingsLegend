import type { Metadata } from "next";
import { LegalPage } from "@/features/content/legal-page";

export const metadata: Metadata = { title: "Contacto", alternates: { canonical: "/contacto" } };

export default function ContactPage() {
  return <LegalPage slug="contacto" />;
}
