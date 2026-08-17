package com.construction.manager.util

// Network-error message patterns come from Ktor/OkHttp and Java's underlying
// exceptions when the phone can't reach the internet. When the OS-level
// OfflineBanner is already shown, repeating the raw "Unable to resolve host"
// text below the form is just noise, so surfaces call `friendlyError()` to
// swallow those cases and keep any real error (wrong password, 400s, etc.).
private val NETWORK_ERROR_PATTERNS = listOf(
    "unable to resolve host",
    "no address associated with hostname",
    "failed to connect",
    "connection refused",
    "connection reset",
    "connection timed out",
    "network is unreachable",
    "unreachable",
    "socket timeout",
    "sockettimeoutexception",
    "socket_timeout",
    "timeout has expired",
    "unknownhostexception",
    "no internet",
    "trust anchor",
    "ssl handshake",
    "http request to",
)

fun isNetworkError(message: String?): Boolean {
    if (message.isNullOrBlank()) return false
    val lower = message.lowercase()
    return NETWORK_ERROR_PATTERNS.any { lower.contains(it) }
}

// Returns null for network-related errors so callers can hide the raw
// stack-trace-ish text (the offline banner already covers this case), and
// translates a handful of common cryptic errors into plain English. Any
// other message is returned unchanged so real backend errors still surface.
fun friendlyError(message: String?): String? {
    if (isNetworkError(message)) return null
    if (message.isNullOrBlank()) return message

    val lower = message.lowercase()
    return when {
        // Google One Tap / Credential Manager errors
        lower.contains("cannot find a matching credential") ||
            lower.contains("no credentials available") ->
            "No Google account is signed in on this phone. Add one in Settings, or use email sign-in instead."
        lower.contains("cancelled") && lower.contains("credential") ->
            "Google sign-in was cancelled."
        lower.contains("developer_error") ||
            lower.contains("developer console is not set up") ||
            lower.contains("10:") ->
            "Google sign-in isn't set up for this build yet. Use email sign-in instead."
        lower.contains("api exception") && lower.contains("16:") ->
            "No matching Google account on this phone. Use email sign-in instead."
        // Supabase auth errors
        lower.contains("invalid login credentials") ->
            "Wrong email or password."
        lower.contains("email not confirmed") ->
            "Please confirm your email before signing in — check your inbox."
        lower.contains("user already registered") ->
            "An account with this email already exists. Try signing in instead."
        else -> message
    }
}
