'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { collection, query, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/lib/useAuth'

interface ErrorLog {
  id: string
  timestamp: Timestamp
  flow: string
  userId: string
  errorType: string
  message: string
  errString: string
  severity: 'error' | 'warn'
  code?: string
}

function formatDate(ts: Timestamp): string {
  const d = ts.toDate()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export default function ErrorLogsPage() {
  const { isDeveloper, loading: authLoading } = useAuth()
  const router = useRouter()

  const [logs, setLogs] = useState<ErrorLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filterFlow, setFilterFlow] = useState('')
  const [filterSeverity, setFilterSeverity] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  useEffect(() => {
    if (!authLoading && !isDeveloper) router.replace('/profil')
  }, [authLoading, isDeveloper, router])

  useEffect(() => {
    if (!isDeveloper) return
    async function load() {
      try {
        const snap = await getDocs(
          query(collection(db, 'errorLogs'), orderBy('timestamp', 'desc'), limit(500))
        )
        setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as ErrorLog)))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [isDeveloper])

  const filtered = useMemo(() => {
    let list = logs
    if (filterFlow) list = list.filter(l => l.flow === filterFlow)
    if (filterSeverity) list = list.filter(l => l.severity === filterSeverity)
    if (filterFrom) {
      const from = new Date(filterFrom)
      list = list.filter(l => l.timestamp.toDate() >= from)
    }
    if (filterTo) {
      const to = new Date(filterTo); to.setHours(23, 59, 59, 999)
      list = list.filter(l => l.timestamp.toDate() <= to)
    }
    return list
  }, [logs, filterFlow, filterSeverity, filterFrom, filterTo])

  function exportCsv() {
    const header = ['Timestamp', 'Severity', 'Code', 'Flow', 'Fehlertyp', 'Meldung', 'UserID', 'Detail']
    const rows = filtered.map(l => [
      formatDate(l.timestamp),
      l.severity,
      l.code ?? '',
      l.flow,
      l.errorType,
      `"${l.message.replace(/"/g, '""')}"`,
      l.userId,
      `"${(l.errString ?? '').replace(/"/g, '""').slice(0, 200)}"`,
    ])
    const csv = [header, ...rows].map(r => r.join(';')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'error-log.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  if (authLoading || !isDeveloper) return null

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-navy">Fehler-Log</h1>
          <p className="text-sm text-navy/50 mt-1">Fehler werden in dieser Ansicht erst ab dem 09.06.2026, 19:00 Uhr erfasst.</p>
        </div>
        <button type="button" onClick={exportCsv} disabled={filtered.length === 0}
          className="text-sm border border-navy/20 text-navy/60 px-4 py-2 rounded-md hover:border-navy/40 hover:text-navy transition-colors disabled:opacity-40">
          CSV exportieren
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-navy/50">Flow</span>
          <select value={filterFlow} onChange={e => setFilterFlow(e.target.value)}
            className="border border-navy/20 rounded-md px-3 py-2 text-sm text-navy focus:outline-none focus:border-orange">
            <option value="">Alle</option>
            <option value="model">Model</option>
            <option value="setting">Setting</option>
            <option value="shooting">Shooting</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-navy/50">Schweregrad</span>
          <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)}
            className="border border-navy/20 rounded-md px-3 py-2 text-sm text-navy focus:outline-none focus:border-orange">
            <option value="">Alle</option>
            <option value="error">Error</option>
            <option value="warn">Warn</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-navy/50">Von</span>
          <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
            className="border border-navy/20 rounded-md px-3 py-2 text-sm text-navy focus:outline-none focus:border-orange" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-navy/50">Bis</span>
          <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
            className="border border-navy/20 rounded-md px-3 py-2 text-sm text-navy focus:outline-none focus:border-orange" />
        </div>
        {(filterFlow || filterSeverity || filterFrom || filterTo) && (
          <button type="button" onClick={() => { setFilterFlow(''); setFilterSeverity(''); setFilterFrom(''); setFilterTo('') }}
            className="text-sm text-navy/50 hover:text-navy transition-colors pb-2">
            Filter zurücksetzen
          </button>
        )}
      </div>

      {/* Stats */}
      <p className="text-xs text-navy/40">
        {filtered.length} Einträge {filtered.length !== logs.length && `(von ${logs.length} gesamt)`} · max. 500 neueste
      </p>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-3 text-navy/60">
          <div className="w-5 h-5 border-2 border-orange border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Logs werden geladen …</span>
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <p className="text-navy/50 text-sm">Keine Einträge gefunden.</p>
      )}

      {!loading && filtered.length > 0 && (
        <div className="border border-navy/10 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-navy/5 border-b border-navy/10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-navy/50 whitespace-nowrap">Zeitpunkt</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-navy/50">Severity</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-navy/50">Code</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-navy/50">Flow</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-navy/50">Fehlertyp</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-navy/50">Meldung</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-navy/50">UserID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/5">
              {filtered.map(log => (
                <tr key={log.id} className="hover:bg-navy/[0.02] transition-colors">
                  <td className="px-4 py-3 text-navy/60 whitespace-nowrap font-mono text-xs">{formatDate(log.timestamp)}</td>
                  <td className="px-3 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${log.severity === 'error' ? 'bg-red-50 text-red-600' : 'bg-yellow-50 text-yellow-600'}`}>
                      {log.severity.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-navy/70 font-mono text-xs">{log.code ?? '—'}</td>
                  <td className="px-3 py-3 text-navy/70 font-mono text-xs">{log.flow}</td>
                  <td className="px-3 py-3 text-navy/70 font-mono text-xs">{log.errorType}</td>
                  <td className="px-4 py-3 text-navy max-w-xs">
                    <p className="truncate" title={log.message}>{log.message}</p>
                    {log.errString && (
                      <p className="text-xs text-navy/40 truncate mt-0.5" title={log.errString}>{log.errString.slice(0, 120)}</p>
                    )}
                  </td>
                  <td className="px-3 py-3 text-navy/40 font-mono text-xs truncate max-w-[120px]" title={log.userId}>{log.userId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
