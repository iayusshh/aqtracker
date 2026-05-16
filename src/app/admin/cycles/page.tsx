'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Calendar, Plus, Edit2, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { Modal } from '@/components/ui/modal'
import { CycleForm } from '@/components/admin/cycle-form'
import { Badge } from '@/components/ui/badge'

interface Cycle {
  id: string
  name: string
  phase: string
  window_open: string
  window_close: string
  status: string
}

type ModalMode = 'create' | 'edit'

function statusBadge(status: string) {
  if (status === 'active') return <Badge variant="green">Active</Badge>
  if (status === 'closed') return <Badge variant="gray">Closed</Badge>
  return <Badge variant="amber">Draft</Badge>
}

export default function CyclesPage() {
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ mode: ModalMode; cycle?: Cycle } | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const showToast = useCallback((type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }, [])

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/cycles')
    if (res.ok) {
      const data = await res.json()
      setCycles(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreate = async (data: any) => {
    const res = await fetch('/api/admin/cycles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error ?? 'Failed to create')
    }
    const created = await res.json()
    setCycles((prev) => [created, ...prev])
    setModal(null)
    showToast('success', 'Cycle created')
  }

  const handleEdit = async (data: any) => {
    const res = await fetch('/api/admin/cycles', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: modal?.cycle?.id, ...data }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error ?? 'Failed to update')
    }
    const updated = await res.json()
    setCycles((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
    setModal(null)
    showToast('success', 'Cycle updated')
  }

  const toggleStatus = async (cycle: Cycle) => {
    const newStatus = cycle.status === 'active' ? 'closed' : 'active'
    const res = await fetch('/api/admin/cycles', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: cycle.id, status: newStatus }),
    })
    if (res.ok) {
      const updated = await res.json()
      setCycles((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      showToast('success', `Cycle ${newStatus}`)
    } else {
      showToast('error', 'Failed to update status')
    }
  }

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/admin/cycles?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      setCycles((prev) => prev.filter((c) => c.id !== id))
      showToast('success', 'Cycle deleted')
    } else {
      showToast('error', 'Failed to delete')
    }
    setDeleteId(null)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="text-blue-600" size={24} />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Goal Cycles</h1>
              <p className="text-sm text-gray-500">Manage goal cycle windows</p>
            </div>
          </div>
          <button
            onClick={() => setModal({ mode: 'create' })}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <Plus size={15} />
            New Cycle
          </button>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  {['Name', 'Phase', 'Window Open', 'Window Close', 'Status', 'Actions'].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cycles.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-gray-400">
                      No cycles found. Create one to get started.
                    </td>
                  </tr>
                ) : (
                  cycles.map((cycle) => (
                    <tr key={cycle.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 text-sm font-semibold text-gray-900">{cycle.name}</td>
                      <td className="px-5 py-3 text-sm text-gray-600 capitalize">
                        {cycle.phase.replace('_', ' ')}
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-600">
                        {formatDate(cycle.window_open)}
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-600">
                        {formatDate(cycle.window_close)}
                      </td>
                      <td className="px-5 py-3">{statusBadge(cycle.status)}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setModal({ mode: 'edit', cycle })}
                            title="Edit"
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => toggleStatus(cycle)}
                            title={cycle.status === 'active' ? 'Deactivate' : 'Activate'}
                            className={cn(
                              'rounded-lg p-1.5 transition-colors',
                              cycle.status === 'active'
                                ? 'text-emerald-600 hover:bg-emerald-50'
                                : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'
                            )}
                          >
                            {cycle.status === 'active' ? (
                              <ToggleRight size={16} />
                            ) : (
                              <ToggleLeft size={16} />
                            )}
                          </button>
                          <button
                            onClick={() => setDeleteId(cycle.id)}
                            title="Delete"
                            className="rounded-lg p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal?.mode === 'create' ? 'Create New Cycle' : 'Edit Cycle'}
      >
        <CycleForm
          initial={modal?.cycle}
          onSubmit={modal?.mode === 'create' ? handleCreate : handleEdit}
          onCancel={() => setModal(null)}
          submitLabel={modal?.mode === 'create' ? 'Create' : 'Update'}
        />
      </Modal>

      <Modal
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        title="Delete Cycle"
        className="max-w-sm"
      >
        <p className="text-sm text-gray-600 mb-6">
          Are you sure you want to delete this cycle? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setDeleteId(null)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => deleteId && handleDelete(deleteId)}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </Modal>

      {toast && (
        <div
          className={cn(
            'fixed bottom-4 right-4 z-50 rounded-lg px-4 py-3 text-sm font-medium shadow-lg',
            toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
          )}
        >
          {toast.msg}
        </div>
      )}
    </div>
  )
}
