// app/songs/new/page.tsx
import { Suspense } from 'react'
import SongNewOrEditPageInner from './SongNewOrEditPageInner'

export default function Page() {
  return (
    <Suspense fallback={<div>Ачаалж байна...</div>}>
      <SongNewOrEditPageInner />
    </Suspense>
  )
}