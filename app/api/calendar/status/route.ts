import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { getServiceAccountEmail, checkCalendarAccess, CalendarError } from '@/lib/googleCalendar'

export const dynamic = 'force-dynamic'

// Owner-only. Reports the service-account email the owner must share the
// calendar with (it lives in Secret Manager, so Settings shows it here rather
// than sending the owner hunting through the console), and — once a Calendar ID
// is saved — whether the service account can actually reach that calendar.
export async function GET(req: NextRequest) {
  try {
    const authz = req.headers.get('authorization') || ''
    const token = authz.startsWith('Bearer ') ? authz.slice(7) : ''
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    await adminAuth.verifyIdToken(token)

    const serviceAccount = await getServiceAccountEmail().catch(() => '')

    const snap = await adminDb.collection('settings').doc('business').get()
    const biz: any = snap.exists ? snap.data() : {}
    const calendarId = (biz.calendarId || '').trim()

    if (!calendarId) {
      return NextResponse.json({ serviceAccount, calendarId: '', access: 'unset' })
    }

    try {
      await checkCalendarAccess(calendarId)
      return NextResponse.json({ serviceAccount, calendarId, access: 'ok' })
    } catch (e: any) {
      const reason =
        e instanceof CalendarError && e.status === 404
          ? 'Calendar not found — check the ID, and that it is shared with the address above.'
          : e instanceof CalendarError && e.status === 403
            ? 'Shared, but without permission to change events.'
            : e instanceof CalendarError
              ? `Google Calendar error ${e.status}.`
              : 'Could not reach Google Calendar.'
      return NextResponse.json({ serviceAccount, calendarId, access: 'error', reason })
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unauthorized' }, { status: 401 })
  }
}
