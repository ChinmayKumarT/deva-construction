package com.construction.manager.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialException
import com.construction.manager.BuildConfig
import com.construction.manager.data.Role
import com.construction.manager.ui.components.OrganicBlob
import com.construction.manager.ui.theme.Forest
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import kotlinx.coroutines.launch

private enum class LegalPage { None, Privacy, DeleteAccount }

@Composable
fun AuthScreen(vm: AuthViewModel) {
    // Declared above the branch so the half-filled form survives a trip to the
    // privacy / delete-account pages and back.
    var legal by remember { mutableStateOf(LegalPage.None) }
    var showForgotPassword by remember { mutableStateOf(false) }
    var showMagicLink by remember { mutableStateOf(false) }
    var mode by remember { mutableStateOf("signin") } // signin | signup
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var fullName by remember { mutableStateOf("") }
    var role by remember { mutableStateOf(Role.client) }
    val error by vm.error.collectAsState()

    when {
        showForgotPassword -> ForgotPasswordScreen(vm, onBack = { showForgotPassword = false })
        showMagicLink -> MagicLinkScreen(vm, onBack = { showMagicLink = false })
        legal == LegalPage.Privacy -> PrivacyScreen(onBack = { legal = LegalPage.None })
        legal == LegalPage.DeleteAccount -> DeleteAccountInfoScreen(onBack = { legal = LegalPage.None })
        else -> AuthForm(
            vm = vm,
            mode = mode, onModeChange = { mode = it },
            email = email, onEmailChange = { email = it },
            password = password, onPasswordChange = { password = it },
            fullName = fullName, onFullNameChange = { fullName = it },
            role = role, onRoleChange = { role = it },
            error = error,
            onOpenLegal = { legal = it },
            onForgotPassword = { showForgotPassword = true },
            onMagicLink = { showMagicLink = true },
        )
    }
}

@Composable
private fun AuthForm(
    vm: AuthViewModel,
    mode: String, onModeChange: (String) -> Unit,
    email: String, onEmailChange: (String) -> Unit,
    password: String, onPasswordChange: (String) -> Unit,
    fullName: String, onFullNameChange: (String) -> Unit,
    role: Role, onRoleChange: (Role) -> Unit,
    error: String?,
    onOpenLegal: (LegalPage) -> Unit,
    onForgotPassword: () -> Unit,
    onMagicLink: () -> Unit,
) {
    Box(Modifier.fillMaxSize()) {
        OrganicBlob(
            tint = Forest.copy(alpha = 0.06f),
            modifier = Modifier.size(280.dp).align(Alignment.TopEnd).offset(x = 80.dp, y = (-60).dp),
        )
        Column(
            Modifier.fillMaxSize().padding(24.dp).verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Spacer(Modifier.height(48.dp))
            Text("Deva Construction", style = MaterialTheme.typography.headlineMedium)
            Text(if (mode == "signin") "Sign in" else "Create an account",
                style = MaterialTheme.typography.titleMedium)

        if (mode == "signup") {
            OutlinedTextField(fullName, onFullNameChange, label = { Text("Full name") },
                modifier = Modifier.fillMaxWidth())
        }
        OutlinedTextField(email, onEmailChange, label = { Text("Email") },
            modifier = Modifier.fillMaxWidth())

        var passwordVisible by remember { mutableStateOf(false) }
        OutlinedTextField(
            password, onPasswordChange, label = { Text("Password") },
            visualTransformation = if (passwordVisible) VisualTransformation.None
                else PasswordVisualTransformation(),
            trailingIcon = {
                IconButton(onClick = { passwordVisible = !passwordVisible }) {
                    Icon(
                        if (passwordVisible) Icons.Filled.VisibilityOff else Icons.Filled.Visibility,
                        contentDescription = if (passwordVisible) "Hide password" else "Show password",
                    )
                }
            },
            modifier = Modifier.fillMaxWidth(),
        )

        if (mode == "signin") {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                TextButton(onClick = onMagicLink) { Text("Magic link instead") }
                TextButton(onClick = onForgotPassword) { Text("Forgot password?") }
            }
        }

        if (mode == "signup") {
            Text("Role", style = MaterialTheme.typography.labelLarge)
            // Admin/manager are never self-serve — the owner grants those from
            // the Team access screen. No labour either: labourers are records
            // the site manager maintains, not app users. handle_new_user() also
            // enforces this server-side, so this is UI-only, not the actual
            // security boundary.
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(Role.client, Role.supplier).forEach { r ->
                    FilterChip(
                        selected = role == r,
                        onClick = { onRoleChange(r) },
                        label = { Text(r.name) },
                    )
                }
            }
        }

        error?.let { Text(it, color = MaterialTheme.colorScheme.error) }

        Button(
            onClick = {
                if (mode == "signin") vm.signIn(email.trim(), password)
                else vm.signUp(email.trim(), password, fullName.trim(), role)
            },
            modifier = Modifier.fillMaxWidth(),
        ) { Text(if (mode == "signin") "Sign in" else "Create account") }

        TextButton(onClick = { onModeChange(if (mode == "signin") "signup" else "signin") }) {
            Text(if (mode == "signin") "New here? Create account" else "Have an account? Sign in")
        }

        GoogleSignInButton(vm)

        Row(Modifier.fillMaxWidth().padding(top = 16.dp),
            horizontalArrangement = Arrangement.Center) {
            TextButton(onClick = { onOpenLegal(LegalPage.Privacy) }) {
                Text("Privacy policy", style = MaterialTheme.typography.bodySmall)
            }
            TextButton(onClick = { onOpenLegal(LegalPage.DeleteAccount) }) {
                Text("Delete account", style = MaterialTheme.typography.bodySmall)
            }
        }
        }
    }
}

@Composable
private fun GoogleSignInButton(vm: AuthViewModel) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var googleError by remember { mutableStateOf<String?>(null) }

    Column(Modifier.fillMaxWidth().padding(top = 8.dp)) {
        OutlinedButton(
            onClick = {
                scope.launch {
                    googleError = null
                    try {
                        val option = GetGoogleIdOption.Builder()
                            .setFilterByAuthorizedAccounts(false)
                            .setServerClientId(BuildConfig.GOOGLE_WEB_CLIENT_ID)
                            .build()
                        val request = GetCredentialRequest.Builder()
                            .addCredentialOption(option)
                            .build()
                        val result = CredentialManager.create(context).getCredential(context, request)
                        val googleCred = GoogleIdTokenCredential.createFrom(result.credential.data)
                        vm.signInWithGoogle(googleCred.idToken)
                    } catch (e: GetCredentialException) {
                        // The user cancelling the account picker also lands here --
                        // that's not a failure worth alarming them about.
                        if (e !is androidx.credentials.exceptions.GetCredentialCancellationException) {
                            googleError = e.message ?: "Google sign-in failed"
                        }
                    }
                }
            },
            modifier = Modifier.fillMaxWidth(),
        ) { Text("Continue with Google") }
        googleError?.let {
            Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        }
    }
}

@Composable
private fun ForgotPasswordScreen(vm: AuthViewModel, onBack: () -> Unit) {
    var email by remember { mutableStateOf("") }
    var sent by remember { mutableStateOf(false) }
    val error by vm.error.collectAsState()

    Column(
        Modifier.fillMaxSize().padding(24.dp).verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Spacer(Modifier.height(48.dp))
        Text("Reset your password", style = MaterialTheme.typography.headlineSmall)
        Text("Enter the email on your account and we'll send you a reset link.",
            style = MaterialTheme.typography.bodyMedium)

        if (sent) {
            Text(
                "If that email has an account, a reset link is on its way.",
                color = MaterialTheme.colorScheme.primary,
            )
        } else {
            OutlinedTextField(email, { email = it }, label = { Text("Email") },
                modifier = Modifier.fillMaxWidth())
            error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            Button(
                onClick = { vm.requestPasswordReset(email.trim()) { ok -> if (ok) sent = true } },
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Send reset link") }
        }

        TextButton(onClick = onBack) { Text("← Back to sign in") }
    }
}

@Composable
private fun MagicLinkScreen(vm: AuthViewModel, onBack: () -> Unit) {
    var email by remember { mutableStateOf("") }
    var sent by remember { mutableStateOf(false) }
    val error by vm.error.collectAsState()

    Column(
        Modifier.fillMaxSize().padding(24.dp).verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Spacer(Modifier.height(48.dp))
        Text("Sign in with a magic link", style = MaterialTheme.typography.headlineSmall)
        Text("We'll email you a link to sign in -- no password needed.",
            style = MaterialTheme.typography.bodyMedium)

        if (sent) {
            Text("Check your email for a sign-in link.", color = MaterialTheme.colorScheme.primary)
        } else {
            OutlinedTextField(email, { email = it }, label = { Text("Email") },
                modifier = Modifier.fillMaxWidth())
            error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            Button(
                onClick = { vm.requestMagicLink(email.trim()) { ok -> if (ok) sent = true } },
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Send magic link") }
        }

        TextButton(onClick = onBack) { Text("← Back to sign in") }
    }
}

@Composable
fun ChooseRoleScreen(vm: AuthViewModel) {
    val error by vm.error.collectAsState()

    Column(
        Modifier.fillMaxSize().padding(24.dp).verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Spacer(Modifier.height(48.dp))
        Text("One more thing", style = MaterialTheme.typography.headlineSmall)
        Text("Pick the role that matches you on site before continuing.",
            style = MaterialTheme.typography.bodyMedium)

        error?.let { Text(it, color = MaterialTheme.colorScheme.error) }

        RoleOption(
            title = "Client",
            subtitle = "I'm having a project built and want to track its progress.",
            onClick = { vm.chooseRole(Role.client) },
        )
        RoleOption(
            title = "Supplier",
            subtitle = "I deliver materials and submit bills for projects.",
            onClick = { vm.chooseRole(Role.supplier) },
        )
    }
}

@Composable
private fun RoleOption(title: String, subtitle: String, onClick: () -> Unit) {
    OutlinedButton(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        contentPadding = PaddingValues(16.dp),
    ) {
        Column(Modifier.fillMaxWidth()) {
            Text(title, style = MaterialTheme.typography.titleMedium)
            Text(subtitle, style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
fun ResetPasswordScreen(vm: AuthViewModel) {
    var password by remember { mutableStateOf("") }
    var confirm by remember { mutableStateOf("") }
    var localError by remember { mutableStateOf<String?>(null) }
    val vmError by vm.error.collectAsState()

    Column(
        Modifier.fillMaxSize().padding(24.dp).verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Spacer(Modifier.height(48.dp))
        Text("Set a new password", style = MaterialTheme.typography.headlineSmall)
        Text("Choose a new password for your account.", style = MaterialTheme.typography.bodyMedium)

        var passwordVisible by remember { mutableStateOf(false) }
        OutlinedTextField(
            password, { password = it }, label = { Text("New password") },
            visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
            trailingIcon = {
                IconButton(onClick = { passwordVisible = !passwordVisible }) {
                    Icon(
                        if (passwordVisible) Icons.Filled.VisibilityOff else Icons.Filled.Visibility,
                        contentDescription = if (passwordVisible) "Hide password" else "Show password",
                    )
                }
            },
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            confirm, { confirm = it }, label = { Text("Confirm new password") },
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth(),
        )

        (localError ?: vmError)?.let { Text(it, color = MaterialTheme.colorScheme.error) }

        Button(
            onClick = {
                localError = null
                when {
                    password.length < 8 -> localError = "Password must be at least 8 characters."
                    password != confirm -> localError = "Passwords don't match."
                    else -> vm.updatePassword(password)
                }
            },
            modifier = Modifier.fillMaxWidth(),
        ) { Text("Update password") }
    }
}
