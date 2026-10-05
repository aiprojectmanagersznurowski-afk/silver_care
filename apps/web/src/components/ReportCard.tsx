"use client"

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Clock, Edit3, Send, Save, X, Sparkles, AlertCircle, Check } from 'lucide-react'
import { analyzeReportCompleteness } from '@/lib/completeness-gate'
import { Textarea } from '@/components/ui/textarea'

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
  const completeness = analyzeReportCompleteness(content)

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
    <Card className="rounded-xl border-border bg-card overflow-hidden">
      <CardHeader className="pb-3 border-b border-border bg-muted/30">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base font-display font-semibold text-foreground">
              {report.residents 
                ? `${report.residents.first_name || ''} ${report.residents.last_name || ''}`.trim()
                : 'Podopieczny'
              }
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
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
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary border border-primary/20">
                <CheckCircle2 className="h-3 w-3" />
                Opublikowany dla rodziny
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-foreground border border-border">
                <Clock className="h-3 w-3" />
                Szkic do weryfikacji
              </span>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {isEditing ? (
          <Textarea className="w-full"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Treść raportu..."
          />
        ) : (
          <div className="p-4 bg-muted/30 rounded-xl text-sm leading-relaxed text-foreground whitespace-pre-wrap border border-border">
            {content || 'Brak treści raportu.'}
          </div>
        )}

        {/* Strażnik kompletności raportu opiekuńczego (AI Quality Gate) */}
        {!isPublished && (
          <div className="rounded-xl border border-border bg-muted p-3 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-foreground" />
                Kompletność informacji dla rodziny ({completeness.scorePercent}%)
              </span>
              <span className={`px-2 py-0.5 rounded-full font-medium ${
                completeness.isComplete 
                  ? 'bg-muted text-foreground' 
                  : 'bg-muted text-foreground'
              }`}>
                {completeness.isComplete ? 'Wszystkie kluczowe obszary' : `Brak: ${completeness.missingLabels.join(', ')}`}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {completeness.dimensions.map((dim) => (
                <div
                  key={dim.id}
                  className={`p-2 rounded-lg border flex items-center gap-1.5 transition-colors ${
                    dim.isCovered
                      ? 'bg-muted border-border text-foreground'
                      : 'bg-card border-border text-muted-foreground'
                  }`}
                  title={dim.isCovered ? 'Obszar zawarty w raporcie' : dim.suggestion}
                >
                  {dim.isCovered ? (
                    <Check className="w-3.5 h-3.5 text-foreground shrink-0" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-foreground shrink-0" />
                  )}
                  <span className="truncate">{dim.label}</span>
                </div>
              ))}
            </div>

            {!completeness.isComplete && (
              <p className="text-muted-foreground italic text-[11px] pt-0.5">
                Podpowiedź asystenta: Bliscy najbardziej wyczekują informacji o apetycie, samopoczuciu i aktywności. Możesz uzupełnić treść lub opublikować raport w obecnym kształcie.
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {isEditing ? (
            <>
              <Button 
                disabled={loading} 
                onClick={handleSave} 
                className="rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-semibold gap-1.5"
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
                className="rounded-xl border-border text-foreground hover:bg-muted/50 text-xs font-medium gap-1.5"
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
                  className="rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-semibold gap-1.5"
                >
                  <Send className="h-3.5 w-3.5" />
                  Zatwierdź i publikuj dla rodziny
                </Button>
              )}
              <Button 
                disabled={loading} 
                onClick={() => setIsEditing(true)} 
                variant="outline"
                className="rounded-xl border-border text-foreground hover:bg-muted/50 text-xs font-medium gap-1.5"
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

