import type { ReactNode } from "react";
import { RouteGuard } from "@/components/auth/RouteGuard";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <RouteGuard roles={["ADMIN"]}>{children}</RouteGuard>;
}