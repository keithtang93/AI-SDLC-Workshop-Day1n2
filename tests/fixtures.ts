import { test as baseTest, expect } from '@playwright/test'

export const test = baseTest.extend({
  page: async ({ page, context }, use) => {
    const client = await context.newCDPSession(page)
    await client.send('WebAuthn.enable')
    const { authenticatorId } = await client.send('WebAuthn.addVirtualAuthenticator', {
      options: {
        protocol: 'ctap2',
        transport: 'internal',
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
      },
    })
    await use(page)
    await client.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId }).catch(() => {})
    await client.send('WebAuthn.disable').catch(() => {})
    await client.detach().catch(() => {})
  },
})

export { expect }
