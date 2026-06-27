package com.construction.manager.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.construction.manager.data.Repo
import com.construction.manager.data.Role
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface AuthState {
    data object Loading : AuthState
    data object SignedOut : AuthState
    data class SignedIn(val role: Role) : AuthState
    data class NeedsLink(val message: String) : AuthState
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
                val role = Repo.fetchRole()
                _state.value = if (role != null) AuthState.SignedIn(role)
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

    fun signUp(email: String, password: String, fullName: String, role: Role) {
        viewModelScope.launch {
            _error.value = null
            try {
                Repo.signUp(email, password, fullName, role)
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

    fun deleteAccount(onDone: () -> Unit = {}) {
        viewModelScope.launch {
            _error.value = null
            try {
                Repo.deleteMyAccount()
                refresh()
                onDone()
            } catch (e: Exception) { _error.value = e.message }
        }
    }
}
