"use client"

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export function ReportCard({ report }: { report: any }) {
  const [isEditing, setIsEditing] = useState(false)
  const [content, setContent] = useState(report.content.text || '')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handlePublish = async () => {
    setLoading(true)
    await supabase.from('daily_reports').update({ status: 'PUBLISHED', content: { text: content } }).eq('id', report.id)
    setLoading(false)
    router.refresh()
  }

  const handleSave = async () => {
    setLoading(true)
    await supabase.from('daily_reports').update({ content: { text: content } }).eq('id', report.id)
    setIsEditing(false)
    setLoading(false)
    router.refresh()
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">
          Raport dla: {report.residents?.first_name} {report.residents?.last_name}
        </CardTitle>
        <CardDescription>
          Utworzono: {new Date(report.created_at).toLocaleDateString('pl-PL')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isEditing ? (
          <textarea
            className="w-full p-4 bg-surface-sunken rounded-md text-sm min-h-[100px] border border-border outline-none focus:ring-2 focus:ring-primary"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        ) : (
          <div className="p-4 bg-surface-sunken rounded-md text-sm whitespace-pre-wrap">
            {content || 'Brak wygenerowanego tekstu.'}
          </div>
        )}
        <div className="flex space-x-2">
          {isEditing ? (
            <>
              <Button disabled={loading} onClick={handleSave} className="w-full sm:w-auto" variant="default">Zapisz zmiany</Button>
              <Button disabled={loading} onClick={() => setIsEditing(false)} className="w-full sm:w-auto" variant="outline">Anuluj</Button>
            </>
          ) : (
            <>
              <Button disabled={loading} onClick={handlePublish} className="w-full sm:w-auto" variant="default">Zatwierdź i publikuj</Button>
              <Button disabled={loading} onClick={() => setIsEditing(true)} className="w-full sm:w-auto" variant="outline">Edytuj</Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
