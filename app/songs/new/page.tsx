'use client'

import { Suspense } from 'react'
import SongNewOrEditPageInner from './SongNewOrEditPageInner'

export default function Page() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Ачаалж байна…</p>}>
      <SongNewOrEditPageInner />
    </Suspense>
  )
}