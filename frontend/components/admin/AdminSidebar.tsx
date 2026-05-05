"use client";

/**
 * Admin panel sidebar — single shared chrome for /admin/*.
 *
 * Routes stay deep-linkable (/admin/users, /admin/assignments) but share this
 * left rail so the admin tools feel like one panel rather than separate pages.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  // Treat any path that starts with this prefix as the active tab. Lets sub-
  // routes (e.g. /admin/users/123) keep highlighting "Users".
  match: string;
}

const NAV: NavItem[] = [
  { href: "/admin/users", label: "Users", match: "/admin/users" },
  {
    href: "/admin/assignments",
    label: "Assignments",
    match: "/admin/assignments",
  },
  {
    href: "/admin/departments",
    label: "Departments",
    match: "/admin/departments",
  },
  {
    href: "/admin/doctors",
    label: "Doctor profiles",
    match: "/admin/doctors",
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin sections"
      className="sticky top-6 rounded-md border border-border bg-surface-raised"
    >
      <div className="rounded-t-md border-b border-border bg-surface-sunken px-4 py-2.5">
        <p className="font-mono text-2xs font-medium uppercase tracking-widest text-text-subtle">
          Admin panel
        </p>
      </div>
      <ul className="p-2">
        {NAV.map((item) => {
          const active =
            pathname === item.match || pathname.startsWith(`${item.match}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "block rounded-md px-3 py-2 text-sm transition-colors focus:outline-none focus-visible:shadow-focus",
                  active
                    ? "bg-primary-50 font-medium text-primary-800"
                    : "text-text-body hover:bg-neutral-50 hover:text-text-primary",
                ].join(" ")}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
