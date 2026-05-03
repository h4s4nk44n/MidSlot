import type { ReactNode } from "react";
import { RouteGuard } from "@/components/auth/RouteGuard";

export default function ReceptionLayout({ children }: { children: ReactNode }) {
  return <RouteGuard roles={["RECEPTIONIST"]}>{children}</RouteGuard>;
}