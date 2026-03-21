import api from './api'
import type {
  ApiResponse,
  AlertChannel,
  CreateAlertChannelPayload,
  UpdateAlertChannelPayload,
} from '@/types'

/** Story 10.6: Create a notification channel. */
export async function createChannel(payload: CreateAlertChannelPayload): Promise<AlertChannel> {
  const { data } = await api.post<ApiResponse<AlertChannel>>('/alert-channels', payload)
  return data.data
}

/** Story 10.6: List all notification channels. */
export async function listChannels(): Promise<AlertChannel[]> {
  const { data } = await api.get<ApiResponse<AlertChannel[]>>('/alert-channels')
  return data.data
}

/** Story 10.6: Get a single channel by ID. */
export async function getChannel(id: string): Promise<AlertChannel> {
  const { data } = await api.get<ApiResponse<AlertChannel>>(`/alert-channels/${id}`)
  return data.data
}

/** Story 10.6: Update a notification channel. */
export async function updateChannel(id: string, payload: UpdateAlertChannelPayload): Promise<AlertChannel> {
  const { data } = await api.put<ApiResponse<AlertChannel>>(`/alert-channels/${id}`, payload)
  return data.data
}

/** Story 10.6: Delete a notification channel. */
export async function deleteChannel(id: string): Promise<void> {
  await api.delete(`/alert-channels/${id}`)
}
