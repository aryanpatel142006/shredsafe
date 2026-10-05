// Product analytics (PostHog) for the hosted demo.
//
// Off unless VITE_POSTHOG_KEY is set, and only ever in Sample mode: the demo runs on synthetic files, while a
// workspace connected to a real backend shows real client file names, which must never leave the firm.
// posthog-js is loaded lazily so it doesn't weigh on the first paint; events sent before it loads are queued.
import type { PostHog } from 'posthog-js'
import { mode } from '../api/client'

const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined
const host = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || 'https://us.i.posthog.com'

export const analyticsOn = Boolean(key) && mode === 'mock'

let client: PostHog | null = null
const queue: [string, Record<string, unknown> | undefined][] = []

export function initAnalytics() {
  if (!analyticsOn || client) return
  void import('posthog-js').then(({ default: posthog }) => {
    posthog.init(key!, {
      api_host: host,
      capture_pageview: 'history_change', // React Router navigations count as page views
      person_profiles: 'identified_only', // anonymous visitors only; no profiles are created
      respect_dnt: true,
      // Session replay: on from the code, not only from the project setting. Inputs are masked; the 3D hero
      // is a WebGL canvas, which replays blank unless canvas capture is on.
      disable_session_recording: false,
      session_recording: {
        maskAllInputs: true,
        captureCanvas: { recordCanvas: true, canvasFps: 4, canvasQuality: '0.4' },
      },
      loaded: (ph) => ph.startSessionRecording(true), // ignore sampling / linked-flag gates: record every visit
    })
    client = posthog
    for (const [event, props] of queue.splice(0)) posthog.capture(event, props)
  })
}

// Named product events. Never pass file names, client names or anything typed by the user.
export type AnalyticsEvent =
  | 'try_demo_clicked'
  | 'files_uploaded'
  | 'scan_started'
  | 'file_approved'
  | 'files_bulk_approved'
  | 'file_kept'
  | 'tamper_simulated'
  | 'integrity_check_run'
  | 'certificate_downloaded'
  | 'audit_csv_exported'

// `beacon: true` for events fired right before a full page load, so the browser still delivers them
export function track(event: AnalyticsEvent, props?: Record<string, string | number | boolean>, beacon = false) {
  if (!analyticsOn) return
  if (client) client.capture(event, props, beacon ? { transport: 'sendBeacon', send_instantly: true } : undefined)
  else queue.push([event, props])
}
