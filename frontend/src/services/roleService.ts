import api from './api'
import type { ApiResponse, Role, Permission } from '@/types'

export async function getRoles(): Promise<Role[]> {
  const { data } = await api.get<ApiResponse<Role[]>>('/roles')
  return data.data
}

export async function getRoleById(id: string): Promise<Role> {
  const { data } = await api.get<ApiResponse<Role>>(`/roles/${id}`)
  return data.data
}

export async function createRole(payload: {
  name: string; description?: string; permissionIds?: string[]
}): Promise<Role> {
  const { data } = await api.post<ApiResponse<Role>>('/roles', payload)
  return data.data
}

export async function updateRole(id: string, payload: {
  name: string; description?: string; permissionIds?: string[]
}): Promise<Role> {
  const { data } = await api.put<ApiResponse<Role>>(`/roles/${id}`, payload)
  return data.data
}

export async function updateRolePermissions(id: string, permissionIds: string[]): Promise<Role> {
  const { data } = await api.put<ApiResponse<Role>>(
    `/roles/${id}/permissions`, { roleIds: permissionIds },
  )
  return data.data
}

export async function getPermissions(): Promise<Permission[]> {
  const { data } = await api.get<ApiResponse<Permission[]>>('/roles/permissions')
  return data.data
}
