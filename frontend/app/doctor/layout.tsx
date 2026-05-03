import type { ReactNode } from "react";
import { RouteGuard } from "@/components/auth/RouteGuard";

export default function DoctorLayout({ children }: { children: ReactNode }) {
  return <RouteGuard roles={["DOCTOR"]}>{children}</RouteGuard>;
}