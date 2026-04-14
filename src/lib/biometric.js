/**
 * useBiometric
 * Provides Touch ID / Face ID (WebAuthn) registration and authentication
 * for quick login after the user has already authenticated with email+password.
 *
 * Storage:
 *  - localStorage 'biometric_credential_id'  – base64url-encoded credential ID
 *  - localStorage 'biometric_user_id'         – supabase user id that owns the credential
 */

const CRED_KEY = 'biometric_credential_id'
const USER_KEY = 'biometric_user_id'

// Helpers
function base64urlToBuffer(base64url) {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(base64)
  return Uint8Array.from(bin, c => c.charCodeAt(0))
}

function bufferToBase64url(buffer) {
  const bytes = new Uint8Array(buffer)
  let str = ''
  bytes.forEach(b => { str += String.fromCharCode(b) })
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function randomBytes(n) {
  const arr = new Uint8Array(n)
  crypto.getRandomValues(arr)
  return arr
}

export function isBiometricSupported() {
  return (
    typeof window !== 'undefined' &&
    window.PublicKeyCredential !== undefined &&
    typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
  )
}

export async function isBiometricAvailable() {
  if (!isBiometricSupported()) return false
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

export function getBiometricCredentialId() {
  return localStorage.getItem(CRED_KEY)
}

export function getBiometricUserId() {
  return localStorage.getItem(USER_KEY)
}

export function clearBiometricCredential() {
  localStorage.removeItem(CRED_KEY)
  localStorage.removeItem(USER_KEY)
}

/**
 * Register a new platform credential for the authenticated user.
 * @param {string} userId   Supabase user ID (UUID)
 * @param {string} userEmail
 * @returns {Promise<boolean>} true on success
 */
export async function registerBiometric(userId, userEmail) {
  if (!await isBiometricAvailable()) return false

  const challenge = randomBytes(32)
  const userIdBytes = new TextEncoder().encode(userId)

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: 'NutriPlan', id: window.location.hostname },
      user: { id: userIdBytes, name: userEmail, displayName: userEmail },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },   // ES256
        { type: 'public-key', alg: -257 },  // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60000,
    },
  })

  if (!credential) return false

  const credId = bufferToBase64url(credential.rawId)
  localStorage.setItem(CRED_KEY, credId)
  localStorage.setItem(USER_KEY, userId)
  return true
}

/**
 * Authenticate with biometrics. Returns true if the gesture was accepted.
 * The caller must still log the user into Supabase using a stored session or
 * refresh token; this only proves physical presence.
 */
export async function authenticateBiometric() {
  const credId = getBiometricCredentialId()
  if (!credId || !await isBiometricAvailable()) return false

  const challenge = randomBytes(32)

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      rpId: window.location.hostname,
      allowCredentials: [{
        type: 'public-key',
        id: base64urlToBuffer(credId),
        transports: ['internal'],
      }],
      userVerification: 'required',
      timeout: 60000,
    },
  })

  return !!assertion
}
