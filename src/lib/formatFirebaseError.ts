export type FormattedError =
  | { kind: 'validation'; explanation: string }
  | { kind: 'api'; code?: string; explanation: string; action?: string }

export function validationError(message: string): FormattedError {
  return { kind: 'validation', explanation: message }
}

const STATUS_TEXT: Record<string, string> = {
  'functions/unavailable': 'UNAVAILABLE',
  'functions/resource-exhausted': 'RESOURCE_EXHAUSTED',
  'functions/internal': 'INTERNAL',
  'functions/unauthenticated': 'UNAUTHENTICATED',
  'functions/invalid-argument': 'INVALID_ARGUMENT',
  'functions/not-found': 'NOT_FOUND',
  'functions/deadline-exceeded': 'DEADLINE_EXCEEDED',
}

const HTTP_STATUS_FALLBACK: Record<string, number> = {
  'functions/unauthenticated': 401,
  'functions/invalid-argument': 400,
  'functions/not-found': 404,
  'functions/resource-exhausted': 429,
  'functions/internal': 500,
  'functions/unavailable': 503,
  'functions/deadline-exceeded': 408,
}

export function formatFirebaseError(e: unknown): FormattedError {
  const firebaseCode = (e as { code?: string })?.code ?? ''
  const rawMsg = e instanceof Error ? e.message : String(e)
  const lower = rawMsg.toLowerCase()
  const details = (e as { details?: { httpStatus?: number; source?: string } })?.details
  const httpStatus = details?.httpStatus ?? HTTP_STATUS_FALLBACK[firebaseCode]
  const source = details?.source
  const statusText = STATUS_TEXT[firebaseCode] ?? firebaseCode.replace('functions/', '').toUpperCase()
  const code = [httpStatus, statusText, source && `(${source})`].filter(Boolean).join(' ') || undefined

  let explanation: string
  let action: string

  if (firebaseCode.includes('resource-exhausted') || lower.includes('quota') || lower.includes('resource_exhausted')) {
    explanation = 'Das Kontingent für die Bildgenerierung ist momentan erschöpft.'
    action = 'Bitte versuche es in ein paar Minuten erneut.'
  } else if (firebaseCode.includes('unavailable')) {
    explanation = 'Der Bildgenerierungs-Dienst ist gerade überlastet.'
    action = 'Bitte versuche es in ein paar Minuten erneut.'
  } else if (firebaseCode.includes('deadline-exceeded') || lower.includes('timeout') || lower.includes('timed out') || lower.includes('deadline')) {
    explanation = 'Die Bildgenerierung hat zu lange gedauert.'
    action = 'Bitte versuche es erneut.'
  } else if (firebaseCode.includes('unauthenticated')) {
    explanation = 'Du bist nicht mehr angemeldet.'
    action = 'Bitte lade die Seite neu und melde dich erneut an.'
  } else if (firebaseCode.includes('invalid-argument')) {
    explanation = 'Die Eingaben sind unvollständig oder ungültig.'
    action = 'Bitte überprüfe deine Eingaben und versuche es erneut.'
  } else if (firebaseCode.includes('not-found')) {
    explanation = 'Eine notwendige Konfiguration wurde nicht gefunden.'
    action = 'Bitte wende dich an den Support.'
  } else {
    explanation = 'Bei der Bildgenerierung ist ein interner Fehler aufgetreten.'
    action = 'Bitte versuche es erneut.'
  }

  return { kind: 'api', code, explanation, action }
}
