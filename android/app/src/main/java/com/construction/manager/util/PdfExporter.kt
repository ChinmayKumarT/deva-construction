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
data class PdfSiteDetail(
    val client: String?,
    val address: String?,
    val stage: String?,
    val endDate: String?,
    val extended: Boolean,
    val originalEndDate: String?,
    val extensionReason: String?,
)
data class PdfUpdate(val stage: String?, val note: String?, val date: String, val image: android.graphics.Bitmap?)
data class PdfCashFlowCategory(val label: String, val value: Double, val color: Int)
data class PdfCashFlowProject(
    val name: String, val materials: Double, val labour: Double, val wages: Double,
)

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
        detail: PdfSiteDetail,
        transactions: List<PdfTransaction>,
        updates: List<PdfUpdate>,
    ): Uri {
        val fileName = "${projectName.replace(Regex("[^A-Za-z0-9]+"), "-")}-report.pdf"
        return sharableUri(context, fileName) { file ->
            val doc = PdfDocument()
            val w = PageWriter(doc, projectName)
            w.newPage()

            val subtitlePaint = Paint().apply { color = Color.GRAY; textSize = 10f }
            w.canvas.drawText("Status: $status", MARGIN, w.y, subtitlePaint)
            w.y += 18f

            val detailPaint = Paint().apply { color = TextColor; textSize = 10f }
            val detailLines = listOfNotNull(
                detail.client?.let { "Client: $it" },
                detail.address?.let { "Address: $it" },
                detail.stage?.let { "Current stage: $it" },
                detail.endDate?.let {
                    "Finish date: $it" + if (detail.extended) {
                        " (extended from ${detail.originalEndDate}" +
                            (detail.extensionReason?.let { r -> " · $r" } ?: "") + ")"
                    } else ""
                },
            )
            detailLines.forEach { line ->
                w.canvas.drawText(line, MARGIN, w.y, detailPaint)
                w.y += 13f
            }
            w.y += 8f

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
                w.y += 16f
            }

            if (updates.isNotEmpty()) {
                w.y += 14f
                w.ensureSpace(24f)
                val sectionPaint = Paint().apply { color = TextColor; textSize = 12f; isFakeBoldText = true }
                w.canvas.drawText("Recent updates (${updates.size})", MARGIN, w.y, sectionPaint)
                w.y += 18f

                val updateTextPaint = Paint().apply { color = Color.parseColor("#1E293B"); textSize = 10f }
                updates.forEach { u ->
                    val lines = listOfNotNull(
                        listOfNotNull(u.stage, u.date).joinToString(" · ").ifBlank { null },
                        u.note?.take(100),
                    )
                    w.ensureSpace(lines.size * 13f + 6f)
                    lines.forEach { line ->
                        w.canvas.drawText(line, MARGIN, w.y, updateTextPaint)
                        w.y += 13f
                    }
                    w.y += 4f

                    val bmp = u.image
                    if (bmp != null) {
                        val maxW = 180f
                        val maxH = 135f
                        var dw = maxW
                        var dh = bmp.height.toFloat() / bmp.width.toFloat() * dw
                        if (dh > maxH) {
                            dh = maxH
                            dw = bmp.width.toFloat() / bmp.height.toFloat() * dh
                        }
                        w.ensureSpace(dh + 16f)
                        val dest = RectF(MARGIN, w.y, MARGIN + dw, w.y + dh)
                        w.canvas.drawBitmap(bmp, null, dest, null)
                        w.y += dh + 16f
                    } else {
                        w.y += 6f
                    }
                }
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

    fun exportCashFlowReport(
        context: Context,
        from: String,
        to: String,
        categories: List<PdfCashFlowCategory>,
        total: Double,
        projects: List<PdfCashFlowProject>,
    ): Uri {
        return sharableUri(context, "cash-flow-$from-to-$to.pdf") { file ->
            val doc = PdfDocument()
            val w = PageWriter(doc, "Cash flow")
            w.newPage()

            val subtitlePaint = Paint().apply { color = Color.GRAY; textSize = 10f }
            w.canvas.drawText("$from to $to", MARGIN, w.y, subtitlePaint)
            w.y += 20f

            val labelPaint = Paint().apply { color = TextColor; textSize = 12f; isFakeBoldText = true }
            w.canvas.drawText("Outflow by category", MARGIN, w.y, labelPaint)
            w.y += 16f

            val maxVal = (categories.maxOfOrNull { it.value } ?: 0.0).coerceAtLeast(1.0)
            val barMaxW = PAGE_W - MARGIN * 2 - 150f
            val barX = MARGIN + 150f
            val namePaint = Paint().apply { color = TextColor; textSize = 10f }

            categories.forEach { cat ->
                w.ensureSpace(24f)
                w.canvas.drawText(cat.label, MARGIN, w.y + 8f, namePaint)
                val barPaint = Paint().apply { color = cat.color }
                val bw = (cat.value / maxVal * barMaxW).toFloat().coerceAtLeast(2f)
                w.canvas.drawRect(barX, w.y - 2f, barX + bw, w.y + 12f, barPaint)
                w.canvas.drawText(money(cat.value), barX + bw + 8f, w.y + 8f, namePaint)
                w.y += 24f
            }

            w.y += 10f
            val summaryPaint = Paint().apply { color = TextColor; textSize = 11f }
            w.canvas.drawText("Total outflow: ${money(total)}", MARGIN, w.y, summaryPaint)
            w.y += 26f

            val cashFlowCols = listOf(150f, 90f, 90f, 90f, 90f)
            val headBg = Paint().apply { color = BrandColor }
            w.ensureSpace(24f)
            w.canvas.drawRect(MARGIN, w.y - 12f, PAGE_W - MARGIN, w.y + 4f, headBg)
            drawTableRow(
                w.canvas, w.y,
                listOf(
                    "Project" to cashFlowCols[0], "Materials" to cashFlowCols[1],
                    "Labour" to cashFlowCols[2], "Wages" to cashFlowCols[3], "Total" to cashFlowCols[4],
                ),
                bold = true, color = Color.WHITE,
            )
            w.y += 18f
            projects.forEachIndexed { i, p ->
                w.ensureSpace(16f)
                if (i % 2 == 1) {
                    val stripe = Paint().apply { color = Color.parseColor("#F8FAFC") }
                    w.canvas.drawRect(MARGIN, w.y - 10f, PAGE_W - MARGIN, w.y + 4f, stripe)
                }
                drawTableRow(
                    w.canvas, w.y,
                    listOf(
                        p.name to cashFlowCols[0], money(p.materials) to cashFlowCols[1],
                        money(p.labour) to cashFlowCols[2], money(p.wages) to cashFlowCols[3],
                        money(p.materials + p.labour + p.wages) to cashFlowCols[4],
                    ),
                )
                w.y += 16f
            }
            if (projects.isEmpty()) {
                w.canvas.drawText("No outflow recorded in this date range.", MARGIN, w.y, summaryPaint)
            }

            w.finish()
            FileOutputStream(file).use { doc.writeTo(it) }
            doc.close()
        }
    }

    data class InvoiceMaterial(val name: String, val qty: Double, val unit: String, val unitCost: Double, val total: Double)
    data class InvoiceLabour(val description: String, val amount: Double)
    data class InvoiceChangeOrder(val description: String, val amount: Double)

    fun exportInvoice(
        context: Context,
        invoiceNo: String,
        date: String,
        projectName: String,
        projectAddress: String?,
        clientName: String?,
        clientEmail: String?,
        clientPhone: String?,
        materials: List<InvoiceMaterial>,
        labourPayments: List<InvoiceLabour>,
        changeOrders: List<InvoiceChangeOrder>,
        subtotal: Double,
        gstRate: Int,
        gstAmount: Double,
        grandTotal: Double,
        amountPaid: Double,
        amountDue: Double,
    ): Uri {
        val fileName = "Invoice-$invoiceNo.pdf"
        return sharableUri(context, fileName) { file ->
            val doc = PdfDocument()
            val w = PageWriter(doc, "")
            w.newPage()

            val headerBg = Paint().apply { color = BrandColor }
            w.canvas.drawRect(0f, 0f, PAGE_W.toFloat(), 80f, headerBg)
            val whiteBold = Paint().apply { color = Color.WHITE; textSize = 20f; isFakeBoldText = true }
            w.canvas.drawText("DEVA CONSTRUCTION", MARGIN, 32f, whiteBold)
            val whiteSmall = Paint().apply { color = Color.WHITE; textSize = 9f }
            w.canvas.drawText("Bangalore, Karnataka, India", MARGIN, 48f, whiteSmall)
            w.canvas.drawText("thedeva.co@gmail.com", MARGIN, 60f, whiteSmall)

            val invTitle = Paint().apply { color = Color.WHITE; textSize = 22f; isFakeBoldText = true; textAlign = Paint.Align.RIGHT }
            w.canvas.drawText("INVOICE", PAGE_W - MARGIN, 32f, invTitle)
            val invDetail = Paint().apply { color = Color.WHITE; textSize = 10f; textAlign = Paint.Align.RIGHT }
            w.canvas.drawText("#$invoiceNo", PAGE_W - MARGIN, 48f, invDetail)
            w.canvas.drawText("Date: $date", PAGE_W - MARGIN, 60f, invDetail)

            w.y = 100f
            val sectionHead = Paint().apply { color = BrandColor; textSize = 10f; isFakeBoldText = true }
            val bodyPaint = Paint().apply { color = TextColor; textSize = 10f }

            w.canvas.drawText("BILL TO", MARGIN, w.y, sectionHead)
            w.canvas.drawText("PROJECT", PAGE_W / 2f, w.y, sectionHead)
            w.y += 14f
            w.canvas.drawText(clientName ?: "—", MARGIN, w.y, bodyPaint)
            clientEmail?.let { w.canvas.drawText(it, MARGIN, w.y + 12f, bodyPaint) }
            clientPhone?.let { w.canvas.drawText(it, MARGIN, w.y + 24f, bodyPaint) }
            w.canvas.drawText(projectName, PAGE_W / 2f, w.y, bodyPaint)
            projectAddress?.let { w.canvas.drawText(it, PAGE_W / 2f, w.y + 12f, bodyPaint) }
            w.y += 46f

            val linePaint = Paint().apply { color = Color.parseColor("#E5E7EB"); strokeWidth = 1f }
            w.canvas.drawLine(MARGIN, w.y, PAGE_W - MARGIN, w.y, linePaint)
            w.y += 16f

            val headBg = Paint().apply { color = BrandColor }
            val headText = Paint().apply { color = Color.WHITE; textSize = 9f; isFakeBoldText = true }
            val matCols = listOf(30f, 160f, 50f, 50f, 80f, 80f)

            if (materials.isNotEmpty()) {
                w.canvas.drawText("Materials", MARGIN, w.y, sectionHead)
                w.y += 10f
                w.canvas.drawRect(MARGIN, w.y - 10f, PAGE_W - MARGIN, w.y + 4f, headBg)
                val headers = listOf("#" to matCols[0], "Item" to matCols[1], "Qty" to matCols[2], "Unit" to matCols[3], "Rate" to matCols[4], "Amount" to matCols[5])
                var x = MARGIN
                headers.forEach { (label, width) -> w.canvas.drawText(label, x, w.y, headText); x += width }
                w.y += 16f
                materials.forEachIndexed { i, m ->
                    w.ensureSpace(16f)
                    if (i % 2 == 1) {
                        val stripe = Paint().apply { color = Color.parseColor("#F8FAFC") }
                        w.canvas.drawRect(MARGIN, w.y - 10f, PAGE_W - MARGIN, w.y + 4f, stripe)
                    }
                    drawTableRow(w.canvas, w.y, listOf(
                        "${i + 1}" to matCols[0], m.name to matCols[1], "%,.0f".format(m.qty) to matCols[2],
                        m.unit to matCols[3], money(m.unitCost) to matCols[4], money(m.total) to matCols[5],
                    ))
                    w.y += 16f
                }
                w.y += 12f
            }

            if (labourPayments.isNotEmpty()) {
                w.ensureSpace(40f)
                w.canvas.drawText("Labour Payments", MARGIN, w.y, sectionHead)
                w.y += 10f
                w.canvas.drawRect(MARGIN, w.y - 10f, PAGE_W - MARGIN, w.y + 4f, headBg)
                var x = MARGIN
                listOf("#" to 30f, "Description" to 350f, "Amount" to 100f).forEach { (l, cw) -> w.canvas.drawText(l, x, w.y, headText); x += cw }
                w.y += 16f
                labourPayments.forEachIndexed { i, l ->
                    w.ensureSpace(16f)
                    drawTableRow(w.canvas, w.y, listOf("${i + 1}" to 30f, l.description to 350f, money(l.amount) to 100f))
                    w.y += 16f
                }
                w.y += 12f
            }

            if (changeOrders.isNotEmpty()) {
                w.ensureSpace(40f)
                w.canvas.drawText("Change Orders", MARGIN, w.y, sectionHead)
                w.y += 10f
                w.canvas.drawRect(MARGIN, w.y - 10f, PAGE_W - MARGIN, w.y + 4f, headBg)
                var x = MARGIN
                listOf("#" to 30f, "Description" to 350f, "Amount" to 100f).forEach { (l, cw) -> w.canvas.drawText(l, x, w.y, headText); x += cw }
                w.y += 16f
                changeOrders.forEachIndexed { i, c ->
                    w.ensureSpace(16f)
                    drawTableRow(w.canvas, w.y, listOf("${i + 1}" to 30f, c.description to 350f, money(c.amount) to 100f))
                    w.y += 16f
                }
                w.y += 12f
            }

            w.ensureSpace(120f)
            val summaryX = PAGE_W - 240f
            val summaryLabel = Paint().apply { color = Color.GRAY; textSize = 10f }
            val summaryVal = Paint().apply { color = TextColor; textSize = 10f; textAlign = Paint.Align.RIGHT }

            w.canvas.drawText("Subtotal", summaryX, w.y, summaryLabel)
            w.canvas.drawText(money(subtotal), PAGE_W - MARGIN, w.y, summaryVal)
            w.y += 18f
            w.canvas.drawText("GST ($gstRate%)", summaryX, w.y, summaryLabel)
            w.canvas.drawText(money(gstAmount), PAGE_W - MARGIN, w.y, summaryVal)
            w.y += 18f

            val greenLine = Paint().apply { color = BrandColor; strokeWidth = 2f }
            w.canvas.drawLine(summaryX, w.y - 4f, PAGE_W - MARGIN, w.y - 4f, greenLine)
            w.y += 12f

            val totalLabel = Paint().apply { color = TextColor; textSize = 13f; isFakeBoldText = true }
            val totalVal = Paint().apply { color = TextColor; textSize = 13f; isFakeBoldText = true; textAlign = Paint.Align.RIGHT }
            w.canvas.drawText("Grand Total", summaryX, w.y, totalLabel)
            w.canvas.drawText(money(grandTotal), PAGE_W - MARGIN, w.y, totalVal)
            w.y += 20f

            w.canvas.drawText("Amount Paid", summaryX, w.y, summaryLabel)
            w.canvas.drawText(money(amountPaid), PAGE_W - MARGIN, w.y, summaryVal)
            w.y += 18f

            val dueColor = if (amountDue > 0) OverBudgetColor else BrandColor
            val dueLabel = Paint().apply { color = dueColor; textSize = 11f; isFakeBoldText = true }
            val dueVal = Paint().apply { color = dueColor; textSize = 11f; isFakeBoldText = true; textAlign = Paint.Align.RIGHT }
            w.canvas.drawText("Amount Due", summaryX, w.y, dueLabel)
            w.canvas.drawText(money(amountDue), PAGE_W - MARGIN, w.y, dueVal)

            w.y += 30f
            if (w.y < PAGE_H - 60) {
                w.canvas.drawLine(MARGIN, w.y, PAGE_W - MARGIN, w.y, linePaint)
                w.y += 14f
                val footer = Paint().apply { color = Color.GRAY; textSize = 9f }
                w.canvas.drawText("Thank you for your business.", MARGIN, w.y, footer)
                w.canvas.drawText("Deva Construction · Bangalore, India", MARGIN, w.y + 12f, footer)
            }

            w.finish()
            FileOutputStream(file).use { doc.writeTo(it) }
            doc.close()
        }
    }

    suspend fun downloadBitmap(url: String): android.graphics.Bitmap? =
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            try {
                val options = android.graphics.BitmapFactory.Options().apply { inSampleSize = 2 }
                java.net.URL(url).openStream().use { android.graphics.BitmapFactory.decodeStream(it, null, options) }
            } catch (e: Exception) {
                null
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
