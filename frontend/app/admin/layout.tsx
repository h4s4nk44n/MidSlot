import type { ReactNode } from "react";
import { RouteGuard } from "@/components/auth/RouteGuard";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <RouteGuard roles={["ADMIN"]}>
      <div className="grid grid-cols-12 gap-8">
        <aside className="col-span-12 lg:col-span-3 xl:col-span-2">
          <AdminSidebar />
        </aside>
        <div className="col-span-12 lg:col-span-9 xl:col-span-10">
          {children}
        </div>
      </div>
    </RouteGuard>
  );
}
