package com.construction.manager.data

import com.construction.manager.BuildConfig
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.storage.Storage

val supabase = createSupabaseClient(
    supabaseUrl = BuildConfig.SUPABASE_URL,
    supabaseKey = BuildConfig.SUPABASE_ANON_KEY,
) {
    install(Auth) {
        // Deep link the password-recovery email lands on -- registered as an
        // intent-filter on MainActivity. resetPasswordForEmail() uses this as
        // its default redirect target when called with no explicit redirectUrl.
        scheme = "com.construction.manager"
        host = "reset-password"
    }
    install(Postgrest)
    install(Storage)
}
