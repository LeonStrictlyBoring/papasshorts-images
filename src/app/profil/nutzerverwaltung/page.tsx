'use client'

import { useEffect, useState } from 'react'
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '@/lib/firebase'
import { useAuth } from '@/lib/useAuth'

interface UserRow {
  uid: string
  name: string
  email: string
  role: 'user' | 'admin' | 'developer'
  status: 'pending' | 'active' | 'inactive'
}

function countActiveAdmins(list: UserRow[], excluding?: string) {
  return list.filter(
    (u) => u.role === 'admin' && u.status === 'active' && u.uid !== excluding
  ).length
}

export default function NutzerverwaltungPage() {
  const { user: currentUser, isDeveloper } = useAuth()
  const [users, setUsers] = useState<UserRow[]>([])
  const [draft, setDraft] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<UserRow | null>(null)

  const hasChanges = draft.some((d) => {
    const original = users.find((u) => u.uid === d.uid)
    return original && (original.role !== d.role || original.status !== d.status)
  })

  useEffect(() => { loadUsers() }, [])

  async function loadUsers() {
    setLoading(true)
    try {
      const snap = await getDocs(collection(db, 'users'))
      const rows: UserRow[] = snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<UserRow, 'uid'>) }))
      rows.sort((a, b) => a.name.localeCompare(b.name))
      setUsers(rows)
      setDraft(rows.map((r) => ({ ...r })))
    } catch {
      setError('Nutzer konnten nicht geladen werden.')
    } finally {
      setLoading(false)
    }
  }

  function updateDraftStatus(uid: string, active: boolean) {
    setDraft((prev) => prev.map((u) => u.uid === uid ? { ...u, status: active ? 'active' : 'inactive' } : u))
  }

  function updateDraftRole(uid: string, role: UserRow['role']) {
    if (role === 'developer' && !isDeveloper) {
      setError('Nur Developer dürfen die Developer-Rolle vergeben.')
      return
    }
    setDraft((prev) => prev.map((u) => u.uid === uid ? { ...u, role } : u))
  }

  function cancel() {
    setDraft(users.map((r) => ({ ...r })))
    setError('')
  }

  async function applyChanges() {
    if (countActiveAdmins(draft) < 1) {
      setError('Es muss immer mindestens ein aktiver Admin vorhanden sein.')
      return
    }
    setSaving(true)
    try {
      const changed = draft.filter((d) => {
        const original = users.find((u) => u.uid === d.uid)
        return original && (original.role !== d.role || original.status !== d.status)
      })
      await Promise.all(
        changed.map((d) => updateDoc(doc(db, 'users', d.uid), { role: d.role, status: d.status }))
      )
      setUsers(draft.map((r) => ({ ...r })))
      setError('')
    } catch {
      setError('Änderungen konnten nicht gespeichert werden.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(u: UserRow) {
    setConfirmDelete(null)
    try {
      const fn = httpsCallable<{ uid: string }, { success: boolean }>(functions, 'deleteUser')
      await fn({ uid: u.uid })
      setUsers((prev) => prev.filter((r) => r.uid !== u.uid))
      setDraft((prev) => prev.filter((r) => r.uid !== u.uid))
    } catch (err) {
      const msg = (err as { message?: string }).message ?? 'Löschen fehlgeschlagen.'
      setError(msg)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy">Nutzerverwaltung</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-4 font-bold">×</button>
        </div>
      )}

      {loading ? (
        <p className="text-navy/50 text-sm">Lade Nutzer …</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-navy/10 text-left text-navy/50 text-xs uppercase tracking-wide">
                  <th className="pb-2 pr-4 font-medium">Name</th>
                  <th className="pb-2 pr-4 font-medium">E-Mail</th>
                  <th className="pb-2 pr-4 font-medium">Aktivieren</th>
                  <th className="pb-2 pr-4 font-medium">Rolle</th>
                  <th className="pb-2 font-medium">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy/5">
                {draft.map((u) => {
                  const isDevRow = !isDeveloper && u.role === 'developer'
                  const isLastAdmin = u.role === 'admin' && countActiveAdmins(users, u.uid) < 1
                  return (
                    <tr key={u.uid} className="hover:bg-navy/5">
                      <td className="py-3 pr-4 text-navy font-medium">{u.name}</td>
                      <td className="py-3 pr-4 text-navy/70">{u.email}</td>
                      <td className="py-3 pr-4">
                        {u.role !== 'developer' && (
                          <label className="flex items-center gap-2 cursor-pointer w-fit">
                            <input
                              type="checkbox"
                              checked={u.status === 'active'}
                              onChange={(e) => updateDraftStatus(u.uid, e.target.checked)}
                              className="w-4 h-4 accent-orange"
                            />
                            <span className="text-navy/70">Aktivieren</span>
                          </label>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        {isDevRow ? (
                          <span className="text-navy/60">Developer</span>
                        ) : (
                          <select
                            value={u.role}
                            onChange={(e) => updateDraftRole(u.uid, e.target.value as UserRow['role'])}
                            className="border border-navy/20 rounded px-2 py-1 text-navy focus:outline-none focus:border-orange"
                          >
                            <option value="user">Nutzer</option>
                            <option value="admin">Admin</option>
                            {isDeveloper && <option value="developer">Developer</option>}
                          </select>
                        )}
                      </td>
                      <td className="py-3">
                        {!isDevRow && u.uid !== currentUser?.uid && !isLastAdmin && (
                          <button
                            onClick={() => setConfirmDelete(u)}
                            className="text-xs font-medium px-2 py-1 rounded text-red-600 hover:bg-red-50 transition-colors"
                          >
                            Löschen
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {draft.length === 0 && (
              <p className="text-center text-navy/40 text-sm py-8">Keine Nutzer gefunden.</p>
            )}
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-navy/10">
            <button
              onClick={applyChanges}
              disabled={!hasChanges || saving}
              className="bg-orange text-white font-semibold px-5 py-2 rounded-md hover:bg-orange/90 transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? 'Speichern …' : 'Änderungen übernehmen'}
            </button>
            {hasChanges && (
              <button
                onClick={cancel}
                disabled={saving}
                className="text-sm text-navy/60 hover:text-navy px-3 py-2 transition-colors"
              >
                Abbrechen
              </button>
            )}
          </div>
        </>
      )}

      {confirmDelete && (
        <ConfirmModal
          message={`Nutzer „${confirmDelete.name}" wirklich löschen?`}
          onConfirm={() => handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}

function ConfirmModal({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-navy">Bestätigung</h2>
          <button onClick={onCancel} className="text-navy/40 hover:text-navy text-xl leading-none">×</button>
        </div>
        <p className="text-sm text-navy/80">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="text-sm text-navy/60 hover:text-navy px-3 py-2">Abbrechen</button>
          <button
            onClick={onConfirm}
            className="bg-red-600 text-white text-sm font-semibold px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
          >
            Löschen
          </button>
        </div>
      </div>
    </div>
  )
}
