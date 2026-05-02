import { z } from 'zod'

import { AI_PROVIDER_ID_VALUES } from '@/lib/ai/providers/types'

export const aiProviderIdSchema = z.enum(AI_PROVIDER_ID_VALUES)
