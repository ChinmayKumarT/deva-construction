package com.construction.manager

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.material3.Surface
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.construction.manager.data.supabase
import com.construction.manager.ui.AppNav
import com.construction.manager.ui.AuthViewModel
import com.construction.manager.ui.theme.AppTheme
import io.github.jan.supabase.auth.handleDeeplinks

class MainActivity : ComponentActivity() {
    // Activity-scoped (not per-Composable) so the password-recovery deep
    // link, handled here before Compose even starts, can push state into the
    // same instance AppNav observes.
    private val authViewModel: AuthViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        handleAuthDeeplink(intent)
        setContent {
            AppTheme {
                Surface { AppNav(authViewModel) }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleAuthDeeplink(intent)
    }

    private fun handleAuthDeeplink(intent: Intent) {
        // The recovery email template now routes through the web confirm
        // page first (see app/reset-password/confirm), which hands off here
        // with a raw, still-unconsumed token_hash instead of letting the SDK
        // auto-import a session -- that hand-off is what stops Gmail/Outlook
        // link-prefetch scanners from burning the one-time token before the
        // user actually taps it. Magic-link sign-in still uses the SDK's own
        // handleDeeplinks parsing, so fall back to it when there's no
        // token_hash on the intent.
        val tokenHash = intent.data?.getQueryParameter("token_hash")
        if (tokenHash != null) {
            authViewModel.verifyRecoveryToken(tokenHash)
            return
        }
        supabase.handleDeeplinks(intent) { session ->
            if (session.type == "recovery") authViewModel.onPasswordRecoverySession()
            else authViewModel.refresh()
        }
    }
}
