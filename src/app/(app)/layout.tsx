import { DataProvider } from "@/components/providers/data-provider";
import { AppShell } from "@/components/layout/app-shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <DataProvider>
      <AppShell>{children}</AppShell>
    </DataProvider>
  );
}
