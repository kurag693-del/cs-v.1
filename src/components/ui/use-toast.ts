type ToastVariant = 'default' | 'destructive'

interface ToastPayload {
  title?: string
  description?: string
  variant?: ToastVariant
}

interface ToastApi {
  toast: (payload: ToastPayload) => void
}

export function useToast(): ToastApi {
  return {
    toast: ({ title, description, variant }: ToastPayload) => {
      const prefix = variant === 'destructive' ? 'Error' : 'Info'
      const message = [title, description].filter(Boolean).join('\n')
      if (typeof window !== 'undefined') {
        console.log(`[toast:${prefix}] ${message}`)
      }
    },
  }
}
