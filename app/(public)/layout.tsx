export default function PublicLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // No AuthGate - these pages need to work without authentication
    return <>{children}</>;
}

