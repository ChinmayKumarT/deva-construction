package com.construction.manager.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.construction.manager.data.Role

// TODO: replace with your deployed web app URL before publishing
private const val PRIVACY_URL = "https://your-domain.example.com/privacy"
private const val DELETE_URL = "https://your-domain.example.com/delete-account"

@Composable
fun AuthScreen(vm: AuthViewModel) {
    var mode by remember { mutableStateOf("signin") } // signin | signup
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var fullName by remember { mutableStateOf("") }
    var role by remember { mutableStateOf(Role.client) }
    val error by vm.error.collectAsState()

    Column(
        Modifier.fillMaxSize().padding(24.dp).verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Spacer(Modifier.height(48.dp))
        Text("Construction Manager", style = MaterialTheme.typography.headlineMedium)
        Text(if (mode == "signin") "Sign in" else "Create an account",
            style = MaterialTheme.typography.titleMedium)

        if (mode == "signup") {
            OutlinedTextField(fullName, { fullName = it }, label = { Text("Full name") },
                modifier = Modifier.fillMaxWidth())
        }
        OutlinedTextField(email, { email = it }, label = { Text("Email") },
            modifier = Modifier.fillMaxWidth())
        OutlinedTextField(password, { password = it }, label = { Text("Password") },
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth())

        if (mode == "signup") {
            Text("Role", style = MaterialTheme.typography.labelLarge)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Role.entries.forEach { r ->
                    FilterChip(
                        selected = role == r,
                        onClick = { role = r },
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

        TextButton(onClick = { mode = if (mode == "signin") "signup" else "signin" }) {
            Text(if (mode == "signin") "New here? Create account" else "Have an account? Sign in")
        }

        val context = LocalContext.current
        Row(Modifier.fillMaxWidth().padding(top = 16.dp),
            horizontalArrangement = Arrangement.Center) {
            TextButton(onClick = {
                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(PRIVACY_URL)))
            }) { Text("Privacy policy", style = MaterialTheme.typography.bodySmall) }
            TextButton(onClick = {
                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(DELETE_URL)))
            }) { Text("Delete account", style = MaterialTheme.typography.bodySmall) }
        }
    }
}
