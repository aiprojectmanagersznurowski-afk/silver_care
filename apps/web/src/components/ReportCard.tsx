"use client"

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Clock, Edit3, Send, Save, X } from 'lucide-react'

export interface ReportItem {
  id: string
  resident_id: string
  created_at: string
  status: 'DRAFT' | 'PUBLISHED' | string
  content: {
    text?: string
    [key: string]: unknown
  }
  residents?: {
    first_name?: string
    last_name?: string
  } | null
}

export function ReportCard({ report }: { report: ReportItem }) {
  const [isEditing, setIsEditing] = useState(false)
  const [content, setContent] = useState(report.content?.text || '')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const isPublished = report.status === 'PUBLISHED'

  const handlePublish = async () => {
    setLoading(true)
    await supabase
      .from('daily_reports')
      .update({ status: 'PUBLISHED', content: { text: content } })
      .eq('id', report.id)
    setLoading(false)
    router.refresh()
  }

  const handleSave = async () => {
    setLoading(true)
    await supabase
      .from('daily_reports')
      .update({ content: { text: content } })
      .eq('id', report.id)
    setIsEditing(false)
    setLoading(false)
    router.refresh()
  }

  return (
    <Card className="rounded-2xl border-slate/10 bg-white shadow-sm overflow-hidden">
      <CardHeader className="pb-3 border-b border-slate/5 bg-slate/[0.02]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base font-display font-semibold text-slate">
              {report.residents 
                ? `${report.residents.first_name || ''} ${report.residents.last_name || ''}`.trim()
                : 'Podopieczny'
              }
            </CardTitle>
            <CardDescription className="text-xs text-slate-soft mt-0.5">
              Utworzono: {new Date(report.created_at).toLocaleDateString('pl-PL', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </CardDescription>
          </div>

          <div>
            {isPublished ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-sage/10 px-2.5 py-1 text-xs font-medium text-sage-dark border border-sage/20">
                <CheckCircle2 className="h-3 w-3" />
                Opublikowany dla rodziny
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 border border-amber-500/20">
                <Clock className="h-3 w-3" />
                Szkic do weryfikacji
              </span>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {isEditing ? (
          <textarea
            className="w-full p-4 bg-slate/5 rounded-xl text-sm min-h-[120px] border border-slate/20 outline-none focus:ring-2 focus:ring-sage focus:border-sage text-slate leading-relaxed"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Treść raportu..."
          />
        ) : (
          <div className="p-4 bg-slate/[0.03] rounded-xl text-sm leading-relaxed text-slate whitespace-pre-wrap border border-slate/5">
            {content || 'Brak treści raportu.'}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {isEditing ? (
            <>
              <Button 
                disabled={loading} 
                onClick={handleSave} 
                className="rounded-xl bg-sage hover:bg-sage-dark text-white text-xs font-semibold gap-1.5"
              >
                <Save className="h-3.5 w-3.5" />
                Zapisz zmiany
              </Button>
              <Button 
                disabled={loading} 
                onClick={() => {
                  setContent(report.content?.text || '')
                  setIsEditing(false)
                }} 
                variant="outline"
                className="rounded-xl border-slate/20 text-slate hover:bg-slate/5 text-xs font-medium gap-1.5"
              >
                <X className="h-3.5 w-3.5" />
                Anuluj
              </Button>
            </>
          ) : (
            <>
              {!isPublished && (
                <Button 
                  disabled={loading} 
                  onClick={handlePublish} 
                  className="rounded-xl bg-sage hover:bg-sage-dark text-white text-xs font-semibold gap-1.5"
                >
                  <Send className="h-3.5 w-3.5" />
                  Zatwierdź i publikuj dla rodziny
                </Button>
              )}
              <Button 
                disabled={loading} 
                onClick={() => setIsEditing(true)} 
                variant="outline"
                className="rounded-xl border-slate/20 text-slate hover:bg-slate/5 text-xs font-medium gap-1.5"
              >
                <Edit3 className="h-3.5 w-3.5" />
                {isPublished ? 'Edytuj treść' : 'Edytuj szkic'}
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

