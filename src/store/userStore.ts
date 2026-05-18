'use client';

// Role simulation store — delegates to authStore so role state is shared.
// Use toggleRole() to switch between OWNER and STAFF during development.
export { useAuthStore as useUserStore } from '@/store/authStore';
export type { UserRole } from '@/store/authStore';
