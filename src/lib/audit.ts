/**
 * Audit log helper — writes a record to audit_log on any table mutation.
 */
import { SupabaseClient } from '@supabase/supabase-js'

export interface AuditPayload {
  tableName: string
  recordId: string
  changedBy: string
  changeType: 'insert' | 'update' | 'delete'
  oldValue?: Record<string, unknown> | null
  newValue?: Record<string, unknown> | null
}

export async function writeAuditLog(
  supabase: SupabaseClient,
  payload: AuditPayload
): Promise<void> {
  const { error } = await supabase.from('audit_log').insert({
    table_name: payload.tableName,
    record_id: payload.recordId,
    changed_by: payload.changedBy,
    change_type: payload.changeType,
    old_value: payload.oldValue ?? null,
    new_value: payload.newValue ?? null,
  })
  if (error) {
    // Non-fatal — log to console but don't block the main operation
    console.error('[audit] Failed to write audit log:', error.message)
  }
}
