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

const ROLE_LABELS: Record<string, string> = { user: 'Nutzer', admin: 'Admin', developer: 'Developer' }
const STATUS_LABELS: Record<string, string> = { pending: 'Ausstehend', active: 'Aktiv', inactive: 'Inaktiv' }
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-red-100 text-red-800',
}

export default function NutzerverwaltungPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<UserRow | null>(null)

  useEffect(() => {
    loadUsers()
  }, [])

  async function loadUsers() {
    setLoading(true)
    try {
      const snap = await getDocs(collection(db, 'users'))
      const rows: UserRow[] = snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<UserRow, 'uid'>) }))
      rows.sort((a, b) => a.name.localeCompare(b.name))
      setUsers(rows)
    } catch {
      setError('Nutzer konnten nicht geladen werden.')
    } finally {
      setLoading(false)
    }
  }

  function countActiveAdmins(excluding?: string) {
    return users.filter(
      (u) => (u.role === 'admin' || u.role === 'developer') && u.status === 'active' && u.uid !== excluding
    ).length
  }

  async function updateStatus(u: UserRow, newStatus: 'active' | 'inactive') {
    if ((u.role === 'admin' || u.role === 'developer') && newStatus === 'inactive') {
      if (countActiveAdmins() <= 1) {
        setError('Letzter aktiver Admin/Developer kann nicht deaktiviert werden.')
        return
      }
    }
    await updateDoc(doc(db, 'users', u.uid), { status: newStatus })
    setUsers((prev) => prev.map((r) => (r.uid === u.uid ? { ...r, status: newStatus } : r)))
  }

  async function updateRole(u: UserRow, newRole: 'user' | 'admin' | 'developer') {
    if (u.uid === currentUser?.uid && newRole === 'user') {
      setError('Eigene Rolle kann nicht auf Nutzer herabgesetzt werden.')
      return
    }
    if ((u.role === 'admin' || u.role === 'developer') && newRole === 'user') {
      if (countActiveAdmins() <= 1) {
        setError('Letzter aktiver Admin/Developer kann nicht herabgesetzt werden.')
        return
      }
    }
    await updateDoc(doc(db, 'users', u.uid), { role: newRole })
    setUsers((prev) => prev.map((r) => (r.uid === u.uid ? { ...r, role: newRole } : r)))
  }

  async function handleDelete(u: UserRow) {
    setConfirmDelete(null)
    try {
      const fn = httpsCallable<{ uid: string }, { success: boolean }>(functions, 'deleteUser')
      await fn({ uid: u.uid })
      setUsers((prev) => prev.filter((r) => r.uid !== u.uid))
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
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-navy/10 text-left text-navy/50 text-xs uppercase tracking-wide">
                <th className="pb-2 pr-4 font-medium">Name</th>
                <th className="pb-2 pr-4 font-medium">E-Mail</th>
                <th className="pb-2 pr-4 font-medium">Rolle</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 font-medium">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/5">
              {users.map((u) => (
                <tr key={u.uid} className="hover:bg-navy/5">
                  <td className="py-3 pr-4 text-navy font-medium">{u.name}</td>
                  <td className="py-3 pr-4 text-navy/70">{u.email}</td>
                  <td className="py-3 pr-4">
                    <select
                      value={u.role}
                      onChange={(e) => updateRole(u, e.target.value as UserRow['role'])}
                      className="text-sm border border-navy/20 rounded px-2 py-1 text-navy focus:outline-none focus:border-orange"
                    >
                      <option value="user">Nutzer</option>
                      <option value="admin">Admin</option>
                      <option value="developer">Developer</option>
                    </select>
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[u.status]}`}>
                      {STATUS_LABELS[u.status]}
                    </span>
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      {u.status === 'pending' && (
                        <ActionBtn onClick={() => updateStatus(u, 'active')} label="Freischalten" color="green" />
                      )}
                      {u.status === 'active' && u.uid !== currentUser?.uid && (
                        <ActionBtn onClick={() => updateStatus(u, 'inactive')} label="Deaktivieren" color="yellow" />
                      )}
                      {u.status === 'inactive' && (
                        <ActionBtn onClick={() => updateStatus(u, 'active')} label="Reaktivieren" color="green" />
                      )}
                      {u.uid !== currentUser?.uid && (
                        <ActionBtn onClick={() => setConfirmDelete(u)} label="Löschen" color="red" />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && <p className="text-center text-navy/40 text-sm py-8">Keine Nutzer gefunden.</p>}
        </div>
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

function ActionBtn({ onClick, label, color }: { onClick: () => void; label: string; color: 'green' | 'yellow' | 'red' }) {
  const cls = {
    green: 'text-green-700 hover:bg-green-50',
    yellow: 'text-yellow-700 hover:bg-yellow-50',
    red: 'text-red-600 hover:bg-red-50',
  }[color]
  return (
    <button onClick={onClick} className={`text-xs font-medium px-2 py-1 rounded transition-colors ${cls}`}>
      {label}
    </button>
  )
}

function ConfirmModal({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Modal title="Bestätigung" onClose={onCancel}>
      <div className="space-y-4">
        <p className="text-sm text-navy/80">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="text-sm text-navy/60 hover:text-navy px-3 py-2">Abbrechen</button>
          <button onClick={onConfirm}
            className="bg-red-600 text-white text-sm font-semibold px-4 py-2 rounded-md hover:bg-red-700 transition-colors">
            Löschen
          </button>
        </div>
      </div>
    </Modal>
  )
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-navy">{title}</h2>
          <button onClick={onClose} className="text-navy/40 hover:text-navy text-xl leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-navy mb-1">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'border border-navy/20 rounded-md px-3 py-2 text-navy placeholder:text-navy/30 focus:outline-none focus:border-orange w-full text-sm'
