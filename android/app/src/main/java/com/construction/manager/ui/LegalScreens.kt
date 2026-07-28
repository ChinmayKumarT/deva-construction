package com.construction.manager.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

// Mirrors app/privacy/page.tsx and app/delete-account/page.tsx on the web.
// Keep the two in step — Play Store links to the web copies as the public
// versions, and they must say the same thing.
private const val EFFECTIVE_DATE = "2026-06-25"
private const val CONTACT_EMAIL = "thedeva.co@gmail.com"
private const val DEVELOPER_NAME = "Deva Construction"

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun LegalScaffold(title: String, onBack: () -> Unit,
                          content: @Composable ColumnScope.() -> Unit) {
    BackHandler(onBack = onBack)
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(title) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        },
    ) { padding ->
        Column(
            Modifier.padding(padding).fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            content()
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun Heading(text: String) {
    Text(text, style = MaterialTheme.typography.titleMedium,
        modifier = Modifier.padding(top = 12.dp))
}

@Composable
private fun Body(text: String) {
    Text(text, style = MaterialTheme.typography.bodyMedium)
}

@Composable
private fun Bullet(text: String) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("•", style = MaterialTheme.typography.bodyMedium)
        Text(text, style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
fun PrivacyScreen(onBack: () -> Unit) = LegalScaffold("Privacy policy", onBack) {
    Text("Effective $EFFECTIVE_DATE", style = MaterialTheme.typography.labelMedium)
    Body("This Privacy Policy describes how $DEVELOPER_NAME (\"we\", \"us\") collects, uses, " +
        "and protects information when you use the Deva Construction mobile and web " +
        "applications (\"the App\").")

    Heading("1. Who controls your data")
    Body("The App is a business tool used by individual construction companies. When you use " +
        "the App, your data is collected and controlled by:")
    Bullet("The construction company that invited you — the data controller for business " +
        "records like projects, materials, payments, attendance, and project updates.")
    Bullet("$DEVELOPER_NAME — the data processor for authentication and hosting.")

    Heading("2. What we collect")
    Bullet("Account: email, password (hashed), full name, role — for sign-in and role-based access.")
    Bullet("Business records: project, client, supplier and labourer details; materials; " +
        "payments; attendance — the core app function.")
    Bullet("User content: project update notes and photos you upload — for progress tracking.")
    Bullet("Technical: device type, OS version, IP address, crash logs — for reliability and security.")
    Body("We do not collect precise location, contacts, SMS, microphone, or browsing history.")

    Heading("3. How it is stored")
    Body("Data is stored with Supabase Inc., which provides authentication, Postgres, and " +
        "object storage. Servers are located in the region selected by the construction " +
        "company at account setup. Network traffic is encrypted in transit (HTTPS); passwords " +
        "are hashed at rest.")

    Heading("4. How it is shared")
    Bullet("Within your construction company, business records are visible to admins, managers, " +
        "and to the specific client, supplier or labourer the record concerns. This is enforced " +
        "by row-level security in the database.")
    Bullet("We do not sell data or share it with advertisers.")
    Bullet("We disclose data only when required by law, or to protect our rights or others' safety.")

    Heading("5. Retention")
    Body("We keep your authentication record (email, password hash and profile) until you " +
        "delete your account. Business records are kept by the construction company for " +
        "accounting and audit purposes even after you delete your account; they are unlinked " +
        "from your identity at that point.")

    Heading("6. Your rights")
    Bullet("Delete your account at any time from the menu in the app. This deletes your login " +
        "and profile and signs you out.")
    Bullet("Access and correct: most of your data is visible on your dashboard. Contact the " +
        "admin of your construction company for changes to business records.")
    Bullet("Object or request portability: email $CONTACT_EMAIL and we will respond within 30 days.")

    Heading("7. Children")
    Body("The App is intended for users 18 and over. We do not knowingly collect data from children.")

    Heading("8. Changes")
    Body("We may update this policy. Material changes will be announced inside the App at " +
        "least 14 days before they take effect.")

    Heading("9. Contact")
    Body("Privacy questions: $CONTACT_EMAIL")
}

@Composable
fun DeleteAccountInfoScreen(onBack: () -> Unit) = LegalScaffold("Delete your account", onBack) {
    Body("You can delete your Deva Construction account at any time. Deletion is permanent " +
        "and cannot be undone.")

    Heading("How to delete in the app")
    Bullet("Sign in, then open the menu on your dashboard.")
    Bullet("Tap Delete account and confirm by typing DELETE. Your login is removed immediately " +
        "and you are signed out.")

    Heading("What gets deleted")
    Bullet("Your authentication record (email, password hash, session tokens).")
    Bullet("Your profile row (name, role).")

    Heading("What is kept")
    Bullet("Business records linked to you — the client, supplier or labourer row, plus any " +
        "projects, materials, payments, attendance and project updates you were associated with.")
    Bullet("These records belong to the construction business that uses this app, not to you, " +
        "and are retained for accounting and audit reasons. They are unlinked from your login " +
        "so they no longer identify you.")

    Heading("Need help?")
    Body("Contact the admin of your construction business directly. If you cannot reach them, " +
        "email $CONTACT_EMAIL.")
}
