package com.construction.manager.util

import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.pdf.PdfDocument
import android.net.Uri
import androidx.core.content.FileProvider
import java.io.File
import java.io.FileOutputStream

// Generates simple multi-page PDF reports with hand-drawn pie/bar charts,
// mirroring components/admin/ReportPdf.tsx on the web side. No PDF library --
// android.graphics.pdf.PdfDocument + Canvas is enough for text + basic shapes.

private const val PAGE_W = 595
private const val PAGE_H = 842
private const val MARGIN = 40f

private val BrandColor = Color.parseColor("#16A34A")
private val TrackColor = Color.parseColor("#E2E8F0")
private val SpendColor = Color.parseColor("#F59E0B")
private val OverBudgetColor = Color.parseColor("#DC2626")
private val TextColor = Color.parseColor("#334155")

data class PdfTransaction(val type: String, val description: String, val date: String, val status: String, val amount: Double)
data class PdfSiteSummary(val name: String, val status: String, val completionPct: Double, val budget: Double, val spent: Double)
data class PdfLabourRow(val name: String, val days: String, val earn: String)

object PdfExporter {

    private fun money(v: Double) = "Rs %,.0f".format(v)

    private class PageWriter(private val doc: PdfDocument, private val title: String) {
        var pageNumber = 1
        lateinit var page: PdfDocument.Page
        lateinit var canvas: android.graphics.Canvas
        var y = 0f

        fun newPage() {
            if (::page.isInitialized) doc.finishPage(page)
            page = doc.startPage(PdfDocument.PageInfo.Builder(PAGE_W, PAGE_H, pageNumber).create())
            canvas = page.canvas
            pageNumber++
            y = MARGIN
            val titlePaint = Paint().apply { color = TextColor; textSize = 16f; isFakeBoldText = true }
            canvas.drawText(title, MARGIN, y + 12f, titlePaint)
            y += 34f
        }

        fun ensureSpace(needed: Float) {
            if (y + needed > PAGE_H - MARGIN) newPage()
        }

        fun finish() {
            if (::page.isInitialized) doc.finishPage(page)
        }
    }

    private fun drawPie(canvas: android.graphics.Canvas, cx: Float, cy: Float, r: Float, slices: List<Pair<Double, Int>>) {
        val total = slices.sumOf { it.first }.coerceAtLeast(0.0001)
        var start = -90f
        val paint = Paint(Paint.ANTI_ALIAS_FLAG)
        val rect = RectF(cx - r, cy - r, cx + r, cy + r)
        for ((frac, color) in slices) {
            if (frac <= 0.0) continue
            val sweep = (frac / total * 360.0).toFloat()
            paint.color = color
            canvas.drawArc(rect, start, sweep, true, paint)
            start += sweep
        }
    }

    private fun drawLegend(canvas: android.graphics.Canvas, x: Float, y: Float, items: List<Pair<String, Int>>) {
        val dot = Paint(Paint.ANTI_ALIAS_FLAG)
        val text = Paint().apply { color = TextColor; textSize = 12f }
        items.forEachIndexed { i, (label, color) ->
            val ly = y + i * 18f
            dot.color = color
            canvas.drawCircle(x + 5f, ly - 3f, 5f, dot)
            canvas.drawText(label, x + 16f, ly, text)
        }
    }

    private fun drawTableRow(
        canvas: android.graphics.Canvas,
        y: Float,
        cols: List<Pair<String, Float>>,
        bold: Boolean = false,
        color: Int = TextColor,
    ) {
        val paint = Paint().apply { this.color = color; textSize = 10f; isFakeBoldText = bold }
        var x = MARGIN
        for ((text, width) in cols) {
            canvas.drawText(text.take(40), x, y, paint)
            x += width
        }
    }

    private val txnCols = listOf(90f, 170f, 70f, 70f, 100f)
    private val siteCols = listOf(150f, 70f, 80f, 100f, 100f)

    private fun sharableUri(context: Context, fileName: String, write: (File) -> Unit): Uri {
        val dir = File(context.cacheDir, "reports").apply { mkdirs() }
        val file = File(dir, fileName)
        write(file)
        return FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
    }

    fun exportSiteReport(
        context: Context,
        projectName: String,
        status: String,
        completionPct: Double,
        budget: Double,
        spent: Double,
        transactions: List<PdfTransaction>,
    ): Uri {
        val fileName = "${projectName.replace(Regex("[^A-Za-z0-9]+"), "-")}-report.pdf"
        return sharableUri(context, fileName) { file ->
            val doc = PdfDocument()
            val w = PageWriter(doc, projectName)
            w.newPage()

            val subtitlePaint = Paint().apply { color = Color.GRAY; textSize = 10f }
            w.canvas.drawText("Status: $status", MARGIN, w.y, subtitlePaint)
            w.y += 20f

            val spendPct = if (budget > 0) spent / budget * 100 else if (spent > 0) 999.0 else 0.0
            val overBudget = budget > 0 && spent > budget

            val chartTop = w.y
            val labelPaint = Paint().apply { color = TextColor; textSize = 12f; isFakeBoldText = true }
            w.canvas.drawText("Completion vs remaining work", MARGIN, chartTop, labelPaint)
            drawPie(
                w.canvas, MARGIN + 60f, chartTop + 80f, 55f,
                listOf(completionPct / 100.0 to BrandColor, (1 - completionPct / 100.0) to TrackColor),
            )
            val small = Paint().apply { color = TextColor; textSize = 11f }
            w.canvas.drawText("${"%.0f".format(completionPct)}% complete", MARGIN + 15f, chartTop + 150f, small)

            w.canvas.drawText("Budget vs spent", MARGIN + 280f, chartTop, labelPaint)
            if (overBudget) {
                drawPie(w.canvas, MARGIN + 340f, chartTop + 80f, 55f, listOf(1.0 to OverBudgetColor))
            } else {
                drawPie(
                    w.canvas, MARGIN + 340f, chartTop + 80f, 55f,
                    listOf(spendPct / 100.0 to SpendColor, (1 - spendPct / 100.0) to TrackColor),
                )
            }
            drawLegend(
                w.canvas, MARGIN + 420f, chartTop + 40f,
                listOf("Spend" to (if (overBudget) OverBudgetColor else SpendColor), "Remaining" to TrackColor),
            )
            w.canvas.drawText(
                if (overBudget) "Over budget" else "${"%.0f".format(spendPct)}% of budget spent",
                MARGIN + 295f, chartTop + 150f, small,
            )

            w.y = chartTop + 175f
            val summaryPaint = Paint().apply { color = TextColor; textSize = 11f }
            w.canvas.drawText(
                "Budget ${money(budget)}  ·  Spent ${money(spent)}  ·  Remaining ${money((budget - spent).coerceAtLeast(0.0))}",
                MARGIN, w.y, summaryPaint,
            )
            w.y += 26f

            val headPaint = Paint().apply { color = Color.WHITE; textSize = 10f; isFakeBoldText = true }
            val headBg = Paint().apply { color = BrandColor }
            w.canvas.drawRect(MARGIN, w.y - 12f, PAGE_W - MARGIN, w.y + 4f, headBg)
            drawTableRow(w.canvas, w.y, listOf("Type" to txnCols[0], "Description" to txnCols[1], "Date" to txnCols[2], "Status" to txnCols[3], "Amount" to txnCols[4]), bold = true, color = Color.WHITE)
            w.y += 18f

            transactions.forEachIndexed { i, t ->
                w.ensureSpace(16f)
                if (i % 2 == 1) {
                    val stripe = Paint().apply { color = Color.parseColor("#F8FAFC") }
                    w.canvas.drawRect(MARGIN, w.y - 10f, PAGE_W - MARGIN, w.y + 4f, stripe)
                }
                drawTableRow(
                    w.canvas, w.y,
                    listOf(t.type to txnCols[0], t.description to txnCols[1], t.date to txnCols[2], t.status to txnCols[3], money(t.amount) to txnCols[4]),
                )
                w.y += 16f
            }
            if (transactions.isEmpty()) {
                w.canvas.drawText("No materials or payments recorded for this site yet.", MARGIN, w.y, summaryPaint)
            }

            w.finish()
            FileOutputStream(file).use { doc.writeTo(it) }
            doc.close()
        }
    }

    fun exportSummaryReport(
        context: Context,
        sites: List<PdfSiteSummary>,
        labour: List<PdfLabourRow>,
    ): Uri {
        return sharableUri(context, "reports-summary.pdf") { file ->
            val doc = PdfDocument()
            val w = PageWriter(doc, "Reports summary")
            w.newPage()

            val labelPaint = Paint().apply { color = TextColor; textSize = 12f; isFakeBoldText = true }
            w.canvas.drawText("Budget vs spent by site", MARGIN, w.y, labelPaint)
            drawLegend(w.canvas, PAGE_W - MARGIN - 130f, w.y - 8f, listOf("Budget" to TrackColor, "Spent" to BrandColor))
            w.y += 16f

            val maxVal = (sites.maxOfOrNull { maxOf(it.budget, it.spent) } ?: 1.0).coerceAtLeast(1.0)
            val barMaxW = PAGE_W - MARGIN * 2 - 150f
            val barX = MARGIN + 150f
            val namePaint = Paint().apply { color = TextColor; textSize = 10f }

            sites.forEach { s ->
                w.ensureSpace(30f)
                val label = if (s.name.length > 22) s.name.take(21) + "…" else s.name
                w.canvas.drawText(label, MARGIN, w.y + 8f, namePaint)
                val budgetPaint = Paint().apply { color = TrackColor }
                val spentPaint = Paint().apply { color = if (s.budget > 0 && s.spent > s.budget) OverBudgetColor else BrandColor }
                w.canvas.drawRect(barX, w.y - 4f, barX + (s.budget / maxVal * barMaxW).toFloat(), w.y + 4f, budgetPaint)
                w.canvas.drawRect(barX, w.y + 8f, barX + (s.spent / maxVal * barMaxW).toFloat(), w.y + 16f, spentPaint)
                w.y += 30f
            }

            w.y += 10f
            w.ensureSpace(24f)
            val headBg = Paint().apply { color = BrandColor }
            w.canvas.drawRect(MARGIN, w.y - 12f, PAGE_W - MARGIN, w.y + 4f, headBg)
            drawTableRow(
                w.canvas, w.y,
                listOf("Site" to siteCols[0], "Status" to siteCols[1], "Completion" to siteCols[2], "Budget" to siteCols[3], "Spent" to siteCols[4]),
                bold = true, color = Color.WHITE,
            )
            w.y += 18f
            sites.forEachIndexed { i, s ->
                w.ensureSpace(16f)
                if (i % 2 == 1) {
                    val stripe = Paint().apply { color = Color.parseColor("#F8FAFC") }
                    w.canvas.drawRect(MARGIN, w.y - 10f, PAGE_W - MARGIN, w.y + 4f, stripe)
                }
                drawTableRow(
                    w.canvas, w.y,
                    listOf(
                        s.name to siteCols[0], s.status to siteCols[1],
                        "${"%.1f".format(s.completionPct)}%" to siteCols[2],
                        money(s.budget) to siteCols[3], money(s.spent) to siteCols[4],
                    ),
                )
                w.y += 16f
            }

            w.y += 20f
            w.ensureSpace(40f)
            w.canvas.drawText("Labour: last 7 days", MARGIN, w.y, labelPaint)
            w.y += 18f
            if (labour.isEmpty()) {
                val small = Paint().apply { color = TextColor; textSize = 11f }
                w.canvas.drawText("No attendance recorded in the last 7 days.", MARGIN, w.y, small)
            } else {
                labour.forEachIndexed { i, l ->
                    w.ensureSpace(16f)
                    if (i % 2 == 1) {
                        val stripe = Paint().apply { color = Color.parseColor("#F8FAFC") }
                        w.canvas.drawRect(MARGIN, w.y - 10f, PAGE_W - MARGIN, w.y + 4f, stripe)
                    }
                    drawTableRow(
                        w.canvas, w.y,
                        listOf(l.name to 200f, "${l.days} days" to 150f, l.earn to 150f),
                    )
                    w.y += 16f
                }
            }

            w.finish()
            FileOutputStream(file).use { doc.writeTo(it) }
            doc.close()
        }
    }

    fun share(context: Context, uri: Uri) {
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "application/pdf"
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        context.startActivity(Intent.createChooser(intent, "Save or share report").apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        })
    }
}
