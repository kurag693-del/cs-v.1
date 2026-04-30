import { redirect } from 'next/navigation'

import { getBrands } from '@/lib/brands/actions'
import { validateSession } from '@/lib/auth/lucia'
import { listMyPlatformCredentials } from '@/lib/platform-credentials/actions'

import { IntegrationsClient } from './ui'

export default async function IntegrationsPage() {
  const { user } = await validateSession()
  if (!user?.id) {
    redirect('/login')
  }

  const [brandsResult, credentialsResult] = await Promise.all([
    getBrands(user.id),
    listMyPlatformCredentials(),
  ])

  return (
    <IntegrationsClient
      brands={brandsResult.success ? (brandsResult.data ?? []).map((item) => ({ id: item.id, name: item.name })) : []}
      initialCredentials={credentialsResult.success ? credentialsResult.data : []}
    />
  )
}
