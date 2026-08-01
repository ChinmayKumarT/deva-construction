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
        // Password recovery and magic-link sign-in share one deep link host
        // (Supabase.kt's Auth config, and the OTP provider has no per-call
        // redirect override in this SDK version) -- the imported session's
        // own `type` says which flow this actually is.
        supabase.handleDeeplinks(intent) { session ->
            if (session.type == "recovery") authViewModel.onPasswordRecoverySession()
            else authViewModel.refresh()
        }
    }
}
