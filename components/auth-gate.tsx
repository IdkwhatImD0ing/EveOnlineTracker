"use client"

import { useState, useEffect, useRef, type FormEvent } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { LockKeyhole, AlertCircle, Loader2 } from "lucide-react"

// Dummy password - change this to your desired password
const SITE_PASSWORD = "eve2024"

export function AuthGate({ children }: { children: React.ReactNode }) {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
    const [error, setError] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const passwordRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        // Check if already authenticated
        const auth = localStorage.getItem("eve-tracker-auth")
        setIsAuthenticated(auth === "authenticated")
    }, [])

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const password = passwordRef.current?.value || ""

        if (!password) {
            setError("Please enter a password")
            return
        }

        setIsLoading(true)
        setError("")

        // Simulate a small delay for UX
        setTimeout(() => {
            if (password === SITE_PASSWORD) {
                localStorage.setItem("eve-tracker-auth", "authenticated")
                setIsAuthenticated(true)
            } else {
                setError("Incorrect password. Please try again.")
                if (passwordRef.current) {
                    passwordRef.current.value = ""
                    passwordRef.current.focus()
                }
            }
            setIsLoading(false)
        }, 300)
    }

    // Show nothing while checking auth state
    if (isAuthenticated === null) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <Loader2 className="size-8 animate-spin text-primary" />
            </div>
        )
    }

    // Show protected content if authenticated
    if (isAuthenticated) {
        return <>{children}</>
    }

    // Show password gate
    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-950 to-black p-4">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-800/20 via-transparent to-transparent" />

            <Card className="relative w-full max-w-md border-zinc-800 bg-zinc-950/80 backdrop-blur-sm">
                <CardHeader className="space-y-3 text-center">
                    <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
                        <LockKeyhole className="size-8 text-primary" />
                    </div>
                    <CardTitle className="text-2xl font-bold tracking-tight text-zinc-100">
                        EVE Online Tracker
                    </CardTitle>
                    <CardDescription className="text-zinc-400">
                        Enter the password to access the tracker
                    </CardDescription>
                </CardHeader>

                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-zinc-300">
                                Password
                            </Label>
                            <Input
                                ref={passwordRef}
                                id="password"
                                name="password"
                                type="password"
                                placeholder="Enter password"
                                className="h-11 border-zinc-800 bg-zinc-900/50 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-primary"
                                autoFocus
                                autoComplete="current-password"
                            />
                        </div>

                        {error && (
                            <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
                                <AlertCircle className="size-4" />
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        <Button
                            type="submit"
                            className="h-11 w-full text-base font-medium"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="animate-spin" />
                                    Verifying...
                                </>
                            ) : (
                                <>
                                    <LockKeyhole />
                                    Access Tracker
                                </>
                            )}
                        </Button>
                    </form>
                </CardContent>

                <CardFooter className="justify-center border-t border-zinc-800 pt-6">
                    <p className="text-xs text-zinc-500">
                        Protected access only
                    </p>
                </CardFooter>
            </Card>
        </div>
    )
}
