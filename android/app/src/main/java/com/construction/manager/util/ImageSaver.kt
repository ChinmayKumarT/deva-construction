package com.construction.manager.util

import android.content.ContentValues
import android.content.Context
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.widget.Toast
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.URL

// Saves a project-update photo to the device's Downloads folder -- the
// mobile equivalent of the web client dashboard's "Download photo" link.
// Scoped-storage MediaStore.Downloads (API 29+) needs no permission; below
// that this app doesn't request legacy WRITE_EXTERNAL_STORAGE, so it just
// reports the version isn't supported rather than building a whole runtime
// permission flow for a shrinking slice of devices.
object ImageSaver {
    suspend fun saveToDownloads(context: Context, url: String, filename: String): Boolean =
        withContext(Dispatchers.IO) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
                withContext(Dispatchers.Main) {
                    Toast.makeText(context, "Saving photos needs Android 10 or newer", Toast.LENGTH_LONG).show()
                }
                return@withContext false
            }
            try {
                val bytes = URL(url).openStream().use { it.readBytes() }
                val resolver = context.contentResolver
                val values = ContentValues().apply {
                    put(MediaStore.Downloads.DISPLAY_NAME, filename)
                    put(MediaStore.Downloads.MIME_TYPE, "image/jpeg")
                    put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                }
                val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                    ?: return@withContext false
                resolver.openOutputStream(uri)?.use { it.write(bytes) } ?: return@withContext false
                withContext(Dispatchers.Main) {
                    Toast.makeText(context, "Saved to Downloads", Toast.LENGTH_SHORT).show()
                }
                true
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    Toast.makeText(context, "Couldn't save photo: ${e.message}", Toast.LENGTH_LONG).show()
                }
                false
            }
        }
}
