import { test as base, type Page } from '@playwright/test'
import * as path from 'path'

type AuthFixtures = {
  authedPage: Page
  managerPage: Page
}

export const test = base.extend<AuthFixtures>({
  authedPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: path.join(__dirname, '../.auth/viewer.json'),
    })
    const page = await context.newPage()
    await use(page)
    await context.close()
  },
  managerPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: path.join(__dirname, '../.auth/manager.json'),
    })
    const page = await context.newPage()
    await use(page)
    await context.close()
  },
})

export { expect } from '@playwright/test'
