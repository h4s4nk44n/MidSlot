import type { ReactNode } from "react";
import { RouteGuard } from "@/components/auth/RouteGuard";

export default function PatientLayout({ children }: { children: ReactNode }) {
  return <RouteGuard roles={["PATIENT"]}>{children}</RouteGuard>;
}