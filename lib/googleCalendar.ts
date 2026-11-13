// Google Calendar — server only. Writes delivery and pickup events for an order
// onto the business calendar so jobs show up in the owner's normal Calendar app
// and the crew can subscribe to it read-only.
//
// Auth is a service account, not per-user OAuth: there is one business calendar,
// so there is nothing to gain from a consent screen and refresh tokens. The
// owner shares that calendar with the service-account email and grants "Make
// changes to events". Credential resolution mirrors lib/firebase/admin.ts.
//
// Note: a service account cannot email invitations to guests without Workspace
// domain-wide delegation, so these events never carry attendees. Crew get read
// access to the calendar itself instead.
import 'server-only'
import { JWT, GoogleAuth } from 'google-auth-library'

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar'
const API = 'https://www.googleapis.com/calendar/v3/calendars'

/** A Calendar API failure, carrying the HTTP status so callers can map it. */
export class CalendarError extends Error {
  constructor(public status: number, public body: string) {
    super(`Google Calendar API ${status}`)
    this.name = 'CalendarError'
  }
}

let cachedAuth: JWT | GoogleAuth | null = null

function getAuth(): JWT | GoogleAuth {
  if (cachedAuth) return cachedAuth
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (clientEmail && privateKey) {
    cachedAuth = new JWT({ email: clientEmail, key: privateKey, scopes: [CALENDAR_SCOPE] })
  } else {
    // ADC: App Hosting's compute service account, or GOOGLE_APPLICATION_CREDENTIALS.
    cachedAuth = new GoogleAuth({ scopes: [CALENDAR_SCOPE] })
  }
  return cachedAuth
}

/** The service-account email the owner must share the calendar with. */
export async function getServiceAccountEmail(): Promise<string> {
  const auth = getAuth()
  if (auth instanceof JWT) return auth.email ?? ''
  const creds = await auth.getCredentials()
  return creds.client_email ?? ''
}

async function getAccessToken(): Promise<string> {
  const auth = getAuth()
  if (auth instanceof JWT) {
    const { access_token } = await auth.authorize()
    if (!access_token) throw new Error('Could not get a Google Calendar access token.')
    return access_token
  }
  const client = await auth.getClient()
  const { token } = await client.getAccessToken()
  if (!token) throw new Error('Could not get a Google Calendar access token.')
  return token
}

export interface EventInput {
  summary: string
  description?: string
  location?: string
  /** Local wall-clock start, "YYYY-MM-DDTHH:mm:00" — paired with timeZone. */
  start: string
  end: string
  timeZone: string
}

function body(ev: EventInput) {
  return {
    summary: ev.summary,
    description: ev.description || undefined,
    location: ev.location || undefined,
    start: { dateTime: ev.start, timeZone: ev.timeZone },
    end: { dateTime: ev.end, timeZone: ev.timeZone },
  }
}

async function call(
  method: 'POST' | 'PUT' | 'DELETE' | 'GET',
  path: string,
  payload?: unknown,
): Promise<any> {
  const token = await getAccessToken()
  const res = await fetch(`${API}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(payload ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  })
  // A delete of something already gone is the state we wanted.
  if (method === 'DELETE' && (res.ok || res.status === 404 || res.status === 410)) return null
  if (!res.ok) throw new CalendarError(res.status, await res.text().catch(() => ''))
  return res.json()
}

/**
 * Create or update one event. Passing an existing eventId updates in place so a
 * rescheduled order moves its event instead of leaving a duplicate behind. If
 * that id has since been deleted in Google, falls back to creating a new one and
 * returns the new id.
 */
export async function upsertEvent(
  calendarId: string,
  eventId: string | null,
  ev: EventInput,
): Promise<string> {
  const cal = encodeURIComponent(calendarId)
  if (eventId) {
    try {
      const updated = await call('PUT', `${cal}/events/${encodeURIComponent(eventId)}`, body(ev))
      return updated.id as string
    } catch (e) {
      // 404/410 = the owner deleted it by hand; anything else is a real failure.
      if (!(e instanceof CalendarError) || (e.status !== 404 && e.status !== 410)) throw e
    }
  }
  const created = await call('POST', `${cal}/events`, body(ev))
  return created.id as string
}

/** Remove an event. Safe to call for an id that is already gone. */
export async function deleteEvent(calendarId: string, eventId: string): Promise<void> {
  await call('DELETE', `${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`)
}

/** Confirm the calendar exists and the service account can reach it. */
export async function checkCalendarAccess(calendarId: string): Promise<void> {
  await call('GET', encodeURIComponent(calendarId))
}
