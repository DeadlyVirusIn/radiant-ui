/**
 * User-Friendly Error Message Utility
 *
 * Maps raw technical error strings from the backend into clean,
 * human-readable messages for display in the UI.
 */

const ERROR_MAP = [
  // --- Connection / Proxy Errors ---
  { pattern: /no battleSessionToken returned/i, message: 'Battle failed — please try again.' },
  { pattern: /Gift returned 0-byte response/i, message: 'Gift failed — server did not respond. Please try again.' },
  { pattern: /Trade returned 0-byte response/i, message: 'Trade failed — server did not respond. Please try again.' },
  { pattern: /0-byte response|ZERO_BYTE|0-BYTE/i, message: 'Connection issue — no response from server. Retrying...' },
  { pattern: /ECONNREFUSED/i, message: 'Server connection refused. Please try again later.' },
  { pattern: /ETIMEDOUT|DEADLINE_EXCEEDED/i, message: 'Request timed out. Please try again.' },
  { pattern: /ECONNRESET/i, message: 'Connection was reset. Please try again.' },
  { pattern: /ENOTFOUND/i, message: 'Server not reachable. Please check your connection.' },
  { pattern: /Bot manager unavailable/i, message: 'Bot service is temporarily unavailable. Please try again.' },
  { pattern: /proxy.*pool.*queue.*timeout/i, message: 'All connections are busy. Please wait and try again.' },

  // --- Authentication / Permission ---
  { pattern: /UNAUTHENTICATED/i, message: 'Session expired. Please log in again.' },
  { pattern: /PERMISSION_DENIED|403.*Forbidden/i, message: 'Session expired — refreshing connection...' },
  { pattern: /Invalid token|Token expired/i, message: 'Session expired. Please log in again.' },
  { pattern: /AuthorizeV1 returned no headers/i, message: 'Login failed — connection issue. Retrying...' },

  // --- Rate Limiting ---
  { pattern: /RESOURCE_EXHAUSTED|too many requests|429/i, message: 'Too many requests. Please wait a moment.' },

  // --- Game Logic (user-actionable) ---
  { pattern: /FAILED_PRECONDITION/i, message: 'Action not available — may be completed or daily limit reached.' },
  { pattern: /ALREADY_FRIENDS/i, message: 'Already friends with this player.' },
  { pattern: /REQUEST_WITHDRAWN/i, message: 'Friend request was withdrawn.' },

  // --- Battle-specific ---
  { pattern: /Failed to run battle/i, message: 'Battle failed. Please try again.' },
  { pattern: /No deck available/i, message: 'No deck available. Please create a deck or enable rental deck.' },
  { pattern: /GetStepupBattlesV1 returned no data/i, message: 'Could not load battles. Please refresh the page.' },
  { pattern: /GetEventPowersV1/i, message: 'Could not load event power. Please try again.' },
  { pattern: /battle already completed or locked/i, message: 'Battle already completed or locked.' },

  // --- Gift-specific ---
  { pattern: /daily.*limit/i, message: 'Daily gift limit reached. Try again tomorrow.' },
  { pattern: /TRADE_POWER_IS_INSUFFICIENT/i, message: 'Bot account has no gift/trade power remaining today. Please try again tomorrow.' },
  { pattern: /gift.*power.*exhaust/i, message: 'Bot account gift power exhausted. Please try again tomorrow.' },
  { pattern: /No accounts have this card/i, message: 'This card is currently unavailable. Try a different card or try again later.' },
  { pattern: /All accounts.*busy/i, message: 'All available accounts are busy with other requests. Please wait and try again.' },
  { pattern: /Friend request expired/i, message: 'Friend request was not accepted in time (10 min). Please try again and accept quickly.' },
  { pattern: /Trade session lost/i, message: 'Trade connection was lost. Please try again.' },
  { pattern: /Trade stuck in unexpected state/i, message: 'Trade encountered an issue. Please try again.' },
  { pattern: /Trade.*rejected by partner/i, message: 'Trade was declined. Please try again.' },
  { pattern: /Card selection timed out/i, message: 'Card selection timed out. Please try again and pick a card promptly.' },
  { pattern: /Trade timed out/i, message: 'Trade timed out — it was not completed in time. Please try again.' },
  { pattern: /Gift tutorial.*failed/i, message: 'Bot setup required. Please contact support.' },
  { pattern: /statement timeout/i, message: 'Server was too busy to process this request. Please try again.' },
  { pattern: /Gift execution failed/i, message: 'Gift could not be sent. Please try again.' },
  { pattern: /Gift failed after.*retries/i, message: 'Gift failed after multiple attempts. Please try again later.' },

  // --- Account ---
  { pattern: /Account.*disabled/i, message: 'Account is disabled.' },
  { pattern: /Account.*not found/i, message: 'Account not found or inactive.' },
  { pattern: /Account missing device_password/i, message: 'Account credentials missing. Please re-add the account.' },
  { pattern: /Failed to login to account/i, message: 'Account login failed. Please try again.' },

  // --- Server errors ---
  { pattern: /INTERNAL|500.*Internal/i, message: 'Server error. Please try again.' },
  { pattern: /UNAVAILABLE|503|502/i, message: 'Server temporarily unavailable. Please try again.' },
  { pattern: /ABORTED/i, message: 'Operation was interrupted. Please try again.' },
];

/**
 * Convert a raw backend error string to a user-friendly message.
 * Returns the original message if no mapping is found.
 *
 * @param {string} raw - Raw error string from the backend
 * @returns {string} User-friendly error message
 */
export function friendlyError(raw) {
  if (!raw || typeof raw !== 'string') return raw || 'An unexpected error occurred.';

  for (const { pattern, message } of ERROR_MAP) {
    if (pattern.test(raw)) return message;
  }

  // Strip common technical prefixes
  let cleaned = raw
    .replace(/^(Error:\s*)/i, '')
    .replace(/gRPC code \d+:\s*/i, '')
    .replace(/\(attempt \d+\/\d+\)/g, '')
    .trim();

  return cleaned || 'An unexpected error occurred.';
}

/**
 * Convert a raw bot/trade/gift log message to a user-friendly version.
 * Less aggressive than friendlyError — preserves informational messages
 * and only transforms technical jargon.
 *
 * @param {string} raw - Raw log message
 * @returns {string} User-friendly log message
 */
export function friendlyLog(raw) {
  if (!raw || typeof raw !== 'string') return raw || '';

  // Bot manager log patterns
  const LOG_TRANSFORMS = [
    { pattern: /ListV1.*0-byte/i, replacement: 'Friend list check failed — retrying...' },
    { pattern: /ListV1.*ZERO_BYTE/i, replacement: 'Friend list check failed — retrying...' },
    { pattern: /SendRequestsV1.*0-byte/i, replacement: 'Friend request failed — retrying...' },
    { pattern: /AcceptV1.*0-byte/i, replacement: 'Friend accept failed — retrying...' },
    { pattern: /DeleteV1.*0-byte/i, replacement: 'Friend removal failed — retrying...' },
    { pattern: /Battle start failed: no battleSessionToken returned/i, replacement: 'Battle failed — retrying...' },
    { pattern: /No battleSessionToken returned/i, replacement: 'Battle failed — retrying...' },
    { pattern: /fullSessionReset/i, replacement: 'Refreshing session...' },
    { pattern: /Session reset (complete|successful)/i, replacement: 'Session refreshed.' },
    { pattern: /AuthorizeV1.*failed/i, replacement: 'Login failed — retrying...' },
    { pattern: /PERMISSION_DENIED/i, replacement: 'Session expired — refreshing...' },
    { pattern: /RESOURCE_EXHAUSTED/i, replacement: 'Too many requests — waiting...' },
    { pattern: /ECONNREFUSED/i, replacement: 'Server unavailable — retrying...' },
    { pattern: /ETIMEDOUT/i, replacement: 'Request timed out — retrying...' },
    { pattern: /ECONNRESET/i, replacement: 'Request interrupted — retrying...' },
    { pattern: /gRPC error code \d+/i, replacement: 'Server error — retrying...' },
    { pattern: /proxy.*rotation/i, replacement: 'Retrying with fresh session...' },
    { pattern: /blacklist.*proxy/i, replacement: 'Retrying with fresh session...' },
    { pattern: /Gift returned 0-byte response \(attempt (\d+)\/(\d+)\)/i, replacement: 'Gift failed — no response (attempt $1/$2).' },
    { pattern: /Trade returned 0-byte response/i, replacement: 'Trade failed — no response. Retrying...' },
    { pattern: /0-byte response|ZERO_BYTE/i, replacement: 'No response from server — retrying...' },
  ];

  for (const { pattern, replacement } of LOG_TRANSFORMS) {
    if (pattern.test(raw)) return raw.replace(pattern, replacement);
  }

  return raw;
}

export default { friendlyError, friendlyLog };
