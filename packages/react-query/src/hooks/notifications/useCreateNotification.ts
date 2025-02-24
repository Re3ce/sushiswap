import { NotificationData } from '@sushiswap/ui13/components/toast'
import { useMutation, useQueryClient } from '@tanstack/react-query'

export interface UseCreateNotificationPayload {
  notification: NotificationData
  timestamp: string
}

export const useCreateNotification = ({ account }: { account: string }) => {
  const queryClient = useQueryClient()
  return useMutation({
    // TODO why ts error?
    // @ts-ignore
    mutationKey: ['notifications', { account }],
    mutationFn: ({ notification, timestamp }: UseCreateNotificationPayload) => {
      queryClient.setQueryData<Record<string, NotificationData[]>>(['notifications', { account }], (prevData) => {
        if (!prevData) {
          return {
            [timestamp]: [notification],
          }
        } else {
          const state = { ...prevData }
          if (state[timestamp]) state[timestamp].push(notification)
          else {
            state[timestamp] = [notification]
          }

          return state
        }
      })
    },
  })
}
