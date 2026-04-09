type LogLevel = 'error' | 'warn' | 'info'

const isDev = process.env.NODE_ENV === 'development'

function formatMessage(level: LogLevel, context: string, error?: unknown): string {
  const timestamp = new Date().toISOString()
  const message = error instanceof Error ? error.message : String(error ?? '')
  return `[${timestamp}] ${level.toUpperCase()} [${context}] ${message}`
}

export const logger = {
  error(context: string, error?: unknown) {
    if (isDev) {
      console.error(formatMessage('error', context, error))
    }
    // In production, errors are silently captured
    // Replace with external logging service (e.g., Sentry) if needed
  },

  warn(context: string, message?: string) {
    if (isDev) {
      console.warn(formatMessage('warn', context, message ? new Error(message) : undefined))
    }
  },

  info(context: string, message?: string) {
    if (isDev) {
      console.info(formatMessage('info', context, message ? new Error(message) : undefined))
    }
  },
}
