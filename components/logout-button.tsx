"use client"

import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"

export function LogoutButton() {
    const handleLogout = () => {
        localStorage.removeItem("eve-tracker-auth")
        window.location.reload()
    }

    return (
        <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="size-4" />
            Logout
        </Button>
    )
}

