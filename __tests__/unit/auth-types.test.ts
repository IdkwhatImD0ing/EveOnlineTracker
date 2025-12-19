/**
 * Unit tests for types/auth.ts utility functions
 */
import { describe, it, expect } from 'vitest'
import {
  isApprovedRole,
  isAdminRole,
  APPROVED_ROLES,
  type UserRole,
} from '@/types/auth'

describe('types/auth', () => {
  describe('APPROVED_ROLES', () => {
    it('should include slyce, user, pro, and admin roles', () => {
      expect(APPROVED_ROLES).toContain('slyce')
      expect(APPROVED_ROLES).toContain('user')
      expect(APPROVED_ROLES).toContain('pro')
      expect(APPROVED_ROLES).toContain('admin')
    })

    it('should not include public role', () => {
      expect(APPROVED_ROLES).not.toContain('public')
    })
  })

  describe('isApprovedRole', () => {
    it('should return true for slyce role', () => {
      expect(isApprovedRole('slyce')).toBe(true)
    })

    it('should return true for user role', () => {
      expect(isApprovedRole('user')).toBe(true)
    })

    it('should return true for pro role', () => {
      expect(isApprovedRole('pro')).toBe(true)
    })

    it('should return true for admin role', () => {
      expect(isApprovedRole('admin')).toBe(true)
    })

    it('should return false for public role', () => {
      expect(isApprovedRole('public')).toBe(false)
    })

    it('should handle all UserRole values', () => {
      const allRoles: UserRole[] = ['public', 'slyce', 'user', 'pro', 'admin']
      const approvedCount = allRoles.filter(isApprovedRole).length

      expect(approvedCount).toBe(4) // All except 'public'
    })
  })

  describe('isAdminRole', () => {
    it('should return true only for admin role', () => {
      expect(isAdminRole('admin')).toBe(true)
    })

    it('should return false for slyce role', () => {
      expect(isAdminRole('slyce')).toBe(false)
    })

    it('should return false for user role', () => {
      expect(isAdminRole('user')).toBe(false)
    })

    it('should return false for pro role', () => {
      expect(isAdminRole('pro')).toBe(false)
    })

    it('should return false for public role', () => {
      expect(isAdminRole('public')).toBe(false)
    })
  })
})

