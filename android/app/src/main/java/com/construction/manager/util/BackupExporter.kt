package com.construction.manager.util

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.core.content.FileProvider
import java.io.File
import java.time.LocalDate

// Writes the raw JSON dump from Repo.generateBackupJson() to the app cache
// and hands back a FileProvider Uri that the share sheet accepts. Mirrors
// the web /admin/backup download button -- the user can save it to Drive,
// email it, or drop it into any storage app they trust.
object BackupExporter {
    fun write(context: Context, json: String): Uri {
        val dir = File(context.cacheDir, "backups").apply { mkdirs() }
        val file = File(dir, "deva-backup-${LocalDate.now()}.json")
        file.writeText(json, Charsets.UTF_8)
        return FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
    }

    fun share(context: Context, uri: Uri) {
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "application/json"
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        context.startActivity(
            Intent.createChooser(intent, "Save or share backup").apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            },
        )
    }
}
