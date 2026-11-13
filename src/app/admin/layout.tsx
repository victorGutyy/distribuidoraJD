import type { Metadata } from "next";

// Todo /admin queda fuera de buscadores y con título propio.
export const metadata: Metadata = {
  title: { default: "Panel", template: "%s · Panel JD" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return children;
}
