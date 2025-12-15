import { AuthGate } from "@/components/auth-gate";
import { SidebarLayout } from "@/components/sidebar-layout";

export default function AuthenticatedLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <AuthGate>
            <SidebarLayout>{children}</SidebarLayout>
        </AuthGate>
    );
}

