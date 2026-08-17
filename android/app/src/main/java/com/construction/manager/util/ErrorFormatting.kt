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
    "sockettimeoutexception",
    "unknownhostexception",
    "no internet",
    "trust anchor",
    "ssl handshake",
)

fun isNetworkError(message: String?): Boolean {
    if (message.isNullOrBlank()) return false
    val lower = message.lowercase()
    return NETWORK_ERROR_PATTERNS.any { lower.contains(it) }
}

// Returns null for network-related errors so callers can hide the raw
// stack-trace-ish text (the offline banner already covers this case) and
// returns the original message otherwise.
fun friendlyError(message: String?): String? =
    if (isNetworkError(message)) null else message
