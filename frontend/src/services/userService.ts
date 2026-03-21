import api from './api'
import type { ApiResponse, PagedResponse, UserDetail } from '@/types'

export async function getUsers(page = 0, size = 20): Promise<PagedResponse<UserDetail>> {
  const { data } = await api.get<ApiResponse<PagedResponse<UserDetail>>>(
    '/users', { params: { page, size } },
  )
  return data.data
}

export async function getUserById(id: string): Promise<UserDetail> {
  const { data } = await api.get<ApiResponse<UserDetail>>(`/users/${id}`)
  return data.data
}

export async function createUser(payload: {
  username: string; email: string; password: string; roleIds?: string[]
}): Promise<UserDetail> {
  const { data } = await api.post<ApiResponse<UserDetail>>('/users', payload)
  return data.data
}

export async function updateUser(id: string, payload: {
  email?: string; active?: boolean
}): Promise<UserDetail> {
  const { data } = await api.put<ApiResponse<UserDetail>>(`/users/${id}`, payload)
  return data.data
}

export async function deactivateUser(id: string): Promise<void> {
  await api.delete<ApiResponse<void>>(`/users/${id}`)
}

export async function assignRoles(id: string, roleIds: string[]): Promise<UserDetail> {
  const { data } = await api.put<ApiResponse<UserDetail>>(
    `/users/${id}/roles`, { roleIds },
  )
  return data.data
}

export async function changePassword(id: string, payload: {
  currentPassword: string; newPassword: string
}): Promise<void> {
  await api.put<ApiResponse<void>>(`/users/${id}/password`, payload)
}
