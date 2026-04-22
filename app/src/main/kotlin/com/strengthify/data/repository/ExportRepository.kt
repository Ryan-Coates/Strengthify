package com.strengthify.data.repository

import android.content.ContentValues
import android.content.Context
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import com.strengthify.data.db.SetEntryDao
import com.strengthify.data.db.WorkoutSessionDao
import com.strengthify.data.model.Lift
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.IOException
import java.io.OutputStream
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ExportRepository @Inject constructor(
    @ApplicationContext private val context: Context,
    private val sessionDao: WorkoutSessionDao,
    private val setDao: SetEntryDao,
) {
    /**
     * Exports all sessions + sets as a CSV file written to the device's Downloads folder.
     * Requires no storage permissions on Android 10+.
     *
     * @return The filename that was written, or null if an error occurred.
     */
    suspend fun exportToCsv(): String? = withContext(Dispatchers.IO) {
        val fileName = "strengthify_export_${System.currentTimeMillis()}.csv"

        val outputStream: OutputStream? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val values = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, fileName)
                put(MediaStore.Downloads.MIME_TYPE, "text/csv")
                put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
            }
            val uri = context.contentResolver.insert(
                MediaStore.Downloads.EXTERNAL_CONTENT_URI, values
            ) ?: return@withContext null
            context.contentResolver.openOutputStream(uri)
        } else {
            @Suppress("DEPRECATION")
            val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
            downloadsDir.mkdirs()
            java.io.FileOutputStream(java.io.File(downloadsDir, fileName))
        }

        outputStream ?: return@withContext null

        try {
            outputStream.bufferedWriter().use { writer ->
                writer.write("date,lift,weight_kg,reps,estimated_1rm_kg\n")
                // Fetch all sessions ordered by date
                val allSets = setDao.getAllOrderedByDate()
                for (row in allSets) {
                    val liftName = Lift.entries.find { it.name == row.lift }?.displayName ?: row.lift
                    val oneRm    = row.weightKg * (1f + row.reps / 30f)
                    writer.write("${row.date},\"$liftName\",${row.weightKg},${row.reps},${"%.2f".format(oneRm)}\n")
                }
            }
        } catch (e: IOException) {
            return@withContext null
        } finally {
            outputStream.close()
        }

        fileName
    }
}
