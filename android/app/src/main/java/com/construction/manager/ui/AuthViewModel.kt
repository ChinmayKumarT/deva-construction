package com.construction.manager.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.construction.manager.data.Repo
import com.construction.manager.data.Role
import io.github.jan.supabase.auth.OtpType
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface AuthState {
    data object Loading : AuthState
    data object SignedOut : AuthState
    data class SignedIn(val role: Role, val isOwner: Boolean) : AuthState
    data class NeedsLink(val message: String) : AuthState
    /** Landed here via the password-recovery deep link -- must set a new
     *  password before anything else, regardless of role. */
    data object NeedsPasswordReset : AuthState
    /** Google sign-in carries no role metadata, so a fresh Google signup
     *  lands here instead of a dashboard until they pick client vs. supplier. */
    data object NeedsRoleSelection : AuthState
}

class AuthViewModel : ViewModel() {
    private val _state = MutableStateFlow<AuthState>(AuthState.Loading)
    val state: StateFlow<AuthState> = _state.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    init { refresh() }

    fun refresh() {
        viewModelScope.launch {
            _state.value = AuthState.Loading
            if (Repo.currentUserId() == null) {
                _state.value = AuthState.SignedOut
                return@launch
            }
            try {
                val profile = Repo.fetchMyProfile()
                if (profile?.rolePending == true) {
                    _state.value = AuthState.NeedsRoleSelection
                    return@launch
                }
                val role = Role.fromString(profile?.role)
                _state.value = if (role != null) AuthState.SignedIn(role, profile?.isOwner ?: false)
                else AuthState.NeedsLink("Your profile has no role assigned. Contact admin.")
            } catch (e: Exception) {
                _error.value = e.message
                _state.value = AuthState.SignedOut
            }
        }
    }

    fun signIn(email: String, password: String) {
        viewModelScope.launch {
            _error.value = null
            try {
                Repo.signIn(email, password)
                refresh()
            } catch (e: Exception) { _error.value = e.message }
        }
    }

    fun signInWithGoogle(idToken: String) {
        viewModelScope.launch {
            _error.value = null
            try {
                Repo.signInWithGoogleIdToken(idToken)
                refresh()
            } catch (e: Exception) { _error.value = e.message }
        }
    }

    fun signUp(email: String, password: String, fullName: String, phone: String, role: Role) {
        viewModelScope.launch {
            _error.value = null
            try {
                Repo.signUp(email, password, fullName, phone, role)
                refresh()
            } catch (e: Exception) { _error.value = e.message }
        }
    }

    fun signOut() {
        viewModelScope.launch {
            Repo.signOut()
            refresh()
        }
    }

    /** Called by MainActivity once it's imported the session from the
     *  password-recovery deep link -- overrides whatever [refresh] would
     *  otherwise have landed on. */
    fun onPasswordRecoverySession() {
        _state.value = AuthState.NeedsPasswordReset
    }

    /** Called by MainActivity when the deep link carries a raw token_hash
     *  (from the web confirm page's hand-off) rather than an already-imported
     *  session. Verifying it here, only in response to a real tap that opened
     *  the app, is what keeps email-scanner prefetches from burning the
     *  token. Recovery forces the reset-password screen; magic-link signs
     *  straight into the role dashboard like any other successful sign-in. */
    fun verifyEmailToken(tokenHash: String, type: OtpType.Email) {
        viewModelScope.launch {
            _error.value = null
            try {
                Repo.verifyEmailOtp(tokenHash, type)
                if (type == OtpType.Email.RECOVERY) _state.value = AuthState.NeedsPasswordReset
                else refresh()
            } catch (e: Exception) {
                _error.value = e.message ?: "That link is invalid or has expired."
                _state.value = AuthState.SignedOut
            }
        }
    }

    fun chooseRole(role: Role, onDone: (Boolean) -> Unit = {}) {
        viewModelScope.launch {
            _error.value = null
            try {
                Repo.chooseRole(role)
                refresh()
                onDone(true)
            } catch (e: Exception) {
                _error.value = e.message
                onDone(false)
            }
        }
    }

    fun requestPasswordReset(email: String, onDone: (Boolean) -> Unit = {}) {
        viewModelScope.launch {
            _error.value = null
            try {
                Repo.requestPasswordReset(email)
                onDone(true)
            } catch (e: Exception) {
                _error.value = e.message
                onDone(false)
            }
        }
    }

    fun requestMagicLink(email: String, onDone: (Boolean) -> Unit = {}) {
        viewModelScope.launch {
            _error.value = null
            try {
                Repo.requestMagicLink(email)
                onDone(true)
            } catch (e: Exception) {
                _error.value = e.message
                onDone(false)
            }
        }
    }

    /** Signs out afterward rather than continuing straight into the
     *  dashboard -- "reset done, now sign in with it" is a clearer end
     *  state than silently continuing the session the email link started. */
    fun updatePassword(newPassword: String, onDone: (Boolean) -> Unit = {}) {
        viewModelScope.launch {
            _error.value = null
            try {
                Repo.updatePassword(newPassword)
                Repo.signOut()
                _state.value = AuthState.SignedOut
                onDone(true)
            } catch (e: Exception) {
                _error.value = e.message
                onDone(false)
            }
        }
    }

    /** [onDone] fires whether the delete succeeded or failed; check `error` afterwards. */
    fun deleteAccount(onDone: () -> Unit = {}) {
        viewModelScope.launch {
            _error.value = null
            try {
                Repo.deleteMyAccount()
                refresh()
            } catch (e: Exception) {
                _error.value = e.message ?: "Delete failed"
            }
            onDone()
        }
    }
}
