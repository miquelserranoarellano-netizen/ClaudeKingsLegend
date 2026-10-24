import type { Metadata } from "next";
import { LegalPage } from "@/features/content/legal-page";

export const metadata: Metadata = { title: "Privacidad", alternates: { canonical: "/privacidad" } };

export default function PrivacyPage() {
  return <LegalPage slug="privacidad" />;
}
