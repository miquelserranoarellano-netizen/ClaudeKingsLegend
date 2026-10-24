import type { Metadata } from "next";
import { LegalPage } from "@/features/content/legal-page";

export const metadata: Metadata = { title: "Términos de uso", alternates: { canonical: "/terminos" } };

export default function TermsPage() {
  return <LegalPage slug="terminos" />;
}
