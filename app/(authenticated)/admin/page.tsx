"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  Loader2, 
  Shield, 
  Users, 
  RefreshCw, 
  Check, 
  AlertCircle, 
  Ship, 
  ChevronRight,
  Crown,
  UserCheck,
  Star,
  Globe,
  Zap
} from "lucide-react"
import Link from "next/link"
import type { UserRole } from "@/types/auth"

interface AdminUser {
  id: string
  main_character_id: number
  main_character_name: string
  role: UserRole
  created_at: string
  updated_at: string
}

const ROLE_OPTIONS: { value: UserRole; label: string; description: string; icon: React.ComponentType<{ className?: string }>; gradient: string }[] = [
  { value: 'public', label: 'Public', description: 'Pending approval', icon: Globe, gradient: 'from-zinc-500 to-zinc-600' },
  { value: 'slyce', label: 'Slyce', description: 'Alliance member', icon: Shield, gradient: 'from-blue-500 to-indigo-600' },
  { value: 'user', label: 'User', description: 'Approved user', icon: UserCheck, gradient: 'from-emerald-500 to-teal-600' },
  { value: 'pro', label: 'Pro', description: 'Premium access', icon: Star, gradient: 'from-purple-500 to-violet-600' },
  { value: 'admin', label: 'Admin', description: 'Full access', icon: Crown, gradient: 'from-amber-500 to-orange-600' },
]

const ROLE_COLORS: Record<UserRole, string> = {
  public: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  slyce: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  user: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  pro: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  admin: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
}

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)
  const [successUserId, setSuccessUserId] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/users')
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to fetch users')
      }
      const data = await response.json()
      setUsers(data.users)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const updateUserRole = async (userId: string, newRole: UserRole) => {
    setUpdatingUserId(userId)
    setError(null)
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, role: newRole }),
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update user')
      }
      
      const data = await response.json()
      setUsers(prev => prev.map(u => u.id === userId ? data.user : u))
      
      // Show success indicator briefly
      setSuccessUserId(userId)
      setTimeout(() => setSuccessUserId(null), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user')
    } finally {
      setUpdatingUserId(null)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  // Group users by role for statistics
  const roleStats = users.reduce((acc, user) => {
    acc[user.role] = (acc[user.role] || 0) + 1
    return acc
  }, {} as Record<UserRole, number>)

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6 md:space-y-8">
        {/* Header Card */}
        <Card className="bg-gradient-to-r from-card to-card/50 border-amber-500/20">
          <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 p-4 sm:p-6">
            <div className="size-14 sm:size-16 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Shield className="size-7 sm:size-8 text-white" />
            </div>
            <div className="flex-1 space-y-1">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                Admin Dashboard
              </h1>
              <p className="text-sm md:text-base text-muted-foreground">
                Manage user roles and access permissions
              </p>
              <div className="flex items-center gap-4 pt-1">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="size-3.5" />
                  <span className="font-medium text-foreground">{users.length}</span> users
                </span>
                {!isLoading && (
                  <span className="flex items-center gap-1.5 text-xs text-amber-500">
                    <Crown className="size-3.5" />
                    <span className="font-medium">{roleStats.admin || 0}</span> admins
                  </span>
                )}
              </div>
            </div>
            <Button 
              variant="outline" 
              onClick={fetchUsers}
              disabled={isLoading}
              className="self-end sm:self-auto"
            >
              <RefreshCw className={`size-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </CardContent>
        </Card>

        {/* Admin Sections */}
        <div className="space-y-3 md:space-y-4">
          <h2 className="text-lg md:text-xl font-semibold">Admin Tools</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link href="/admin/fits">
              <Card className="h-full transition-all hover:shadow-lg hover:shadow-primary/5 hover:border-primary/30 cursor-pointer group active:scale-[0.98]">
                <CardContent className="flex items-start gap-3 md:gap-4 p-4 md:p-6">
                  <div className="size-10 md:size-12 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shrink-0">
                    <Ship className="size-5 md:size-6 text-white" />
                  </div>
                  <div className="flex-1 space-y-1 min-w-0">
                    <h3 className="text-sm md:text-base font-semibold group-hover:text-primary transition-colors flex items-center gap-2">
                      Alliance Fits
                      <ChevronRight className="size-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all hidden sm:block" />
                    </h3>
                    <p className="text-xs md:text-sm text-muted-foreground line-clamp-2">
                      Manage alliance ship fittings and doctrine setups
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        {/* Role Stats */}
        <div className="space-y-3 md:space-y-4">
          <h2 className="text-lg md:text-xl font-semibold">User Roles</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
            {ROLE_OPTIONS.map(({ value, label, icon: Icon, gradient }) => (
              <Card key={value} className="transition-all hover:shadow-md hover:border-primary/20">
                <CardContent className="flex items-center gap-2.5 md:gap-4 p-3 md:p-4">
                  <div className={`size-9 md:size-10 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center shadow-md shrink-0`}>
                    <Icon className="size-4 md:size-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-lg md:text-xl font-bold">{roleStats[value] || 0}</p>
                    <p className="text-xs text-muted-foreground truncate">{label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <Card className="border-red-500/50 bg-red-500/10">
            <CardContent className="p-4 flex items-center gap-2 text-red-400">
              <AlertCircle className="size-4 shrink-0" />
              {error}
            </CardContent>
          </Card>
        )}

        {/* Users Table */}
        <Card className="border-primary/10">
          <CardHeader className="border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md">
                <Users className="size-5 text-white" />
              </div>
              <div>
                <CardTitle>Users ({users.length})</CardTitle>
                <CardDescription>
                  Click on a role to change it. Changes take effect immediately.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="size-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Loading users...</p>
                </div>
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-16">
                <div className="size-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
                  <Users className="size-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">No users found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/30">
                      <th className="text-left py-3 px-4 md:px-6 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Character</th>
                      <th className="text-left py-3 px-4 md:px-6 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Role</th>
                      <th className="text-left py-3 px-4 md:px-6 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Created</th>
                      <th className="text-left py-3 px-4 md:px-6 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {users.map(user => (
                      <tr 
                        key={user.id} 
                        className="hover:bg-muted/20 transition-colors group"
                      >
                        <td className="py-4 px-4 md:px-6">
                          <div className="flex items-center gap-3 md:gap-4">
                            <img
                              src={`https://images.evetech.net/characters/${user.main_character_id}/portrait?size=64`}
                              alt={user.main_character_name}
                              className="size-10 md:size-12 rounded-full ring-2 ring-primary/20 shadow-md group-hover:ring-primary/40 transition-all"
                            />
                            <div className="min-w-0">
                              <span className="font-semibold text-sm md:text-base block truncate">{user.main_character_name}</span>
                              <span className="text-xs text-muted-foreground md:hidden">
                                {formatDate(user.created_at)}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 md:px-6">
                          <div className="flex items-center gap-2">
                            <Select
                              value={user.role}
                              onValueChange={(value) => updateUserRole(user.id, value as UserRole)}
                              disabled={updatingUserId === user.id}
                            >
                              <SelectTrigger className="w-28 md:w-32 h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ROLE_OPTIONS.map(option => (
                                  <SelectItem key={option.value} value={option.value}>
                                    <div className="flex items-center gap-2">
                                      <Badge 
                                        variant="outline" 
                                        className={`${ROLE_COLORS[option.value]} text-xs`}
                                      >
                                        {option.label}
                                      </Badge>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {updatingUserId === user.id && (
                              <Loader2 className="size-4 animate-spin text-primary" />
                            )}
                            {successUserId === user.id && (
                              <div className="size-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                <Check className="size-3 text-emerald-400" />
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4 md:px-6 text-sm text-muted-foreground hidden md:table-cell">
                          {formatDate(user.created_at)}
                        </td>
                        <td className="py-4 px-4 md:px-6 text-sm text-muted-foreground hidden lg:table-cell">
                          {formatDate(user.updated_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
