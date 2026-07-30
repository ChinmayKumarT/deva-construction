package com.construction.manager.util

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.core.content.FileProvider
import java.io.File

// CSV export for the Reports screens, alongside PdfExporter. Reuses the same
// Pdf* row data classes and the same FileProvider/share plumbing, just writing
// a .csv (text/csv) so the rows open in a spreadsheet. Amounts are written as
// bare numbers so the spreadsheet treats them as numbers, not text.
object CsvExporter {
    private fun cell(v: String): String =
        if (v.any { it == ',' || it == '"' || it == '\n' || it == '\r' })
            "\"" + v.replace("\"", "\"\"") + "\"" else v

    private fun toCsv(rows: List<List<String>>): String =
        rows.joinToString("\r\n") { row -> row.joinToString(",") { cell(it) } }

    private fun write(context: Context, fileName: String, csv: String): Uri {
        val dir = File(context.cacheDir, "reports").apply { mkdirs() }
        val file = File(dir, fileName)
        file.writeText("﻿" + csv, Charsets.UTF_8) // BOM so Excel reads UTF-8 (₹, names)
        return FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
    }

    private fun slug(s: String): String =
        s.trim().lowercase().replace(Regex("[^a-z0-9]+"), "-").trim('-').ifBlank { "report" }

    fun exportSiteReport(context: Context, projectName: String, transactions: List<PdfTransaction>): Uri {
        val rows = mutableListOf(listOf("Type", "Description", "Date", "Status", "Amount"))
        transactions.forEach {
            rows.add(listOf(it.type, it.description, it.date, it.status, it.amount.toString()))
        }
        return write(context, "${slug(projectName)}-report.csv", toCsv(rows))
    }

    fun exportSummary(context: Context, sites: List<PdfSiteSummary>, labour: List<PdfLabourRow>): Uri {
        val rows = mutableListOf(listOf("Site", "Status", "Completion %", "Budget", "Spent"))
        sites.forEach {
            rows.add(listOf(it.name, it.status, "%.1f".format(it.completionPct), it.budget.toString(), it.spent.toString()))
        }
        rows.add(emptyList())
        rows.add(listOf("Labourer", "Days worked (last 7)", "Wages earned"))
        labour.forEach { rows.add(listOf(it.name, it.days, it.earn)) }
        return write(context, "reports-summary.csv", toCsv(rows))
    }

    fun exportCashFlow(context: Context, from: String, to: String, projects: List<PdfCashFlowProject>): Uri {
        val rows = mutableListOf(
            listOf("Project", "Materials", "Supplier payments", "Labour payments", "Wages (attendance)", "Total"),
        )
        projects.forEach {
            rows.add(
                listOf(
                    it.name, it.materials.toString(), it.supplier.toString(), it.labour.toString(),
                    it.wages.toString(), (it.materials + it.supplier + it.labour + it.wages).toString(),
                ),
            )
        }
        return write(context, "cash-flow-$from-to-$to.csv", toCsv(rows))
    }

    fun share(context: Context, uri: Uri) {
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/csv"
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        context.startActivity(
            Intent.createChooser(intent, "Save or share CSV").apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            },
        )
    }
}
