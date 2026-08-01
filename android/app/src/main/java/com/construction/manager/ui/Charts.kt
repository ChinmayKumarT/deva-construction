package com.construction.manager.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

// Small self-drawn pie charts for the Reports screen. No charting library --
// these are simple enough (two or three slices) that a dependency would cost
// more than it saves.

private val TrackColor = Color(0xFFE2E8F0)
private val OverBudgetColor = Color(0xFFDC2626)
private val SpendColor = Color(0xFFF59E0B)

data class PieSlice(val fraction: Float, val color: Color)

@Composable
private fun PieChart(slices: List<PieSlice>, modifier: Modifier = Modifier) {
    Canvas(modifier) {
        var startAngle = -90f
        val total = slices.sumOf { it.fraction.toDouble() }.toFloat().coerceAtLeast(0.0001f)
        slices.forEach { slice ->
            val sweep = (slice.fraction / total) * 360f
            if (sweep > 0f) {
                drawArc(
                    color = slice.color,
                    startAngle = startAngle,
                    sweepAngle = sweep,
                    useCenter = true,
                )
                startAngle += sweep
            }
        }
    }
}

@Composable
private fun ChartLegend(items: List<Pair<String, Color>>) {
    Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
        items.forEach { (label, color) ->
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Canvas(Modifier.size(10.dp)) { drawCircle(color) }
                Text(label, style = MaterialTheme.typography.labelSmall)
            }
        }
    }
}

@Composable
private fun LabeledPie(
    title: String,
    slices: List<PieSlice>,
    pieSize: Dp = 64.dp,
    modifier: Modifier = Modifier,
) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        PieChart(slices, Modifier.size(pieSize))
        Spacer(Modifier.height(6.dp))
        Text(title, style = MaterialTheme.typography.bodySmall, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
    }
}

/** Per project: a completion pie and a spend-of-budget pie, side by side. */
@Composable
fun CompletionAndSpendPies(
    projectName: String,
    completionPct: Double,
    spendPct: Double,
    modifier: Modifier = Modifier,
) {
    val complete = MaterialTheme.colorScheme.primary
    // Fixed amber rather than colorScheme.secondary -- secondary is Forest
    // (also a green), which reads as barely-distinguishable from Completion's
    // green when the two pies sit side by side.
    val spend = SpendColor
    val completionFrac = (completionPct / 100.0).toFloat().coerceIn(0f, 1f)
    val spendFrac = (spendPct / 100.0).toFloat().coerceIn(0f, 1f)
    val overBudget = spendPct > 100.0

    Column(modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)) {
        Text(projectName, style = MaterialTheme.typography.bodyMedium)
        Spacer(Modifier.height(6.dp))
        ChartLegend(
            listOf(
                "Complete" to complete, "Remaining work" to TrackColor,
                "Spend" to (if (overBudget) OverBudgetColor else spend), "Remaining budget" to TrackColor,
            ),
        )
        Spacer(Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(24.dp)) {
            LabeledPie(
                "Completion\n${"%.0f".format(completionPct)}%",
                listOf(PieSlice(completionFrac, complete), PieSlice(1f - completionFrac, TrackColor)),
            )
            LabeledPie(
                if (overBudget) "Spend\nover budget" else "Spend\n${"%.0f".format(spendPct)}%",
                if (overBudget) listOf(PieSlice(1f, OverBudgetColor))
                else listOf(PieSlice(spendFrac, spend), PieSlice(1f - spendFrac, TrackColor)),
            )
        }
    }
}

/** Per project: a single spent-vs-remaining budget pie, red/full if over budget. */
@Composable
fun BudgetPie(label: String, budget: Double, spent: Double, modifier: Modifier = Modifier) {
    val overBudget = budget > 0.0 && spent > budget
    val fraction = if (budget <= 0.0) (if (spent > 0) 1f else 0f) else (spent / budget).toFloat()
    val primary = MaterialTheme.colorScheme.primary

    Column(modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)) {
        Text(label, style = MaterialTheme.typography.bodyMedium)
        Spacer(Modifier.height(6.dp))
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            PieChart(
                if (overBudget) listOf(PieSlice(1f, OverBudgetColor))
                else listOf(PieSlice(fraction.coerceIn(0f, 1f), primary), PieSlice((1f - fraction).coerceIn(0f, 1f), TrackColor)),
                Modifier.size(64.dp),
            )
            Column {
                if (!overBudget) ChartLegend(listOf("Spent" to primary, "Remaining" to TrackColor))
                Text(
                    if (overBudget) "Over budget by ${money(spent - budget)}"
                    else "${money(spent)} of ${money(budget)} spent · " +
                        "${money((budget - spent).coerceAtLeast(0.0))} remaining",
                    style = MaterialTheme.typography.bodySmall,
                    color = if (overBudget) OverBudgetColor else MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

data class CashFlowCategory(val label: String, val value: Double, val color: Color)

/** Materials cost, supplier payments and labour payments as three horizontal
 * bars -- deliberately shown as separate outflow categories rather than
 * summed into "spent" (which only counts labour payments, to avoid
 * double-counting against materials cost). */
@Composable
fun CashFlowBarChart(categories: List<CashFlowCategory>, modifier: Modifier = Modifier) {
    val max = (categories.maxOfOrNull { it.value } ?: 0.0).coerceAtLeast(1.0)
    Column(modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)) {
        categories.forEach { cat ->
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
            ) {
                Text(cat.label, Modifier.width(110.dp), style = MaterialTheme.typography.bodySmall)
                Box(Modifier.weight(1f).height(16.dp)) {
                    Canvas(Modifier.fillMaxSize()) {
                        val fraction = (cat.value / max).toFloat().coerceIn(0f, 1f)
                        val w = (fraction * size.width).coerceAtLeast(4f)
                        drawRect(cat.color, size = androidx.compose.ui.geometry.Size(w, size.height))
                    }
                }
                Spacer(Modifier.width(8.dp))
                Text(money(cat.value), style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

data class CashFlowDailyPoint(val date: String, val total: Double)

private val TrendLineColor = Color(0xFF16A34A)
private val TrendFillColor = Color(0x1A16A34A)
private val TrendAxisColor = Color(0xFF94A3B8)

/** Cumulative running-total outflow over a date range, as a filled line --
 *  shows whether spend is front-loaded, steady, or spiking, which the bar
 *  chart's per-category totals alone can't. Mirrors web's CashFlowTrendChart. */
@Composable
fun CashFlowTrendChart(daily: List<CashFlowDailyPoint>, modifier: Modifier = Modifier) {
    var running = 0.0
    val cumulative = daily.map { it.date to (running + it.total).also { r -> running = r } }
    val max = (cumulative.maxOfOrNull { it.second } ?: 0.0).coerceAtLeast(1.0)
    val n = (cumulative.size - 1).coerceAtLeast(1)

    Column(modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)) {
        Canvas(Modifier.fillMaxWidth().height(140.dp)) {
            val w = size.width
            val h = size.height
            listOf(0f, 0.5f, 1f).forEach { frac ->
                val y = h * (1f - frac)
                drawLine(TrackColor, Offset(0f, y), Offset(w, y), strokeWidth = 1f)
            }
            if (cumulative.size > 1) {
                val points = cumulative.mapIndexed { i, (_, total) ->
                    Offset(x = (i.toFloat() / n) * w, y = h - (total / max).toFloat() * h)
                }
                val path = Path().apply {
                    moveTo(points.first().x, h)
                    points.forEach { lineTo(it.x, it.y) }
                    lineTo(points.last().x, h)
                    close()
                }
                drawPath(path, TrendFillColor)
                for (i in 0 until points.size - 1) {
                    drawLine(TrendLineColor, points[i], points[i + 1], strokeWidth = 4f)
                }
            }
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            listOf(0, n / 2, n).distinct().forEach { i ->
                Text(
                    cumulative.getOrNull(i)?.first?.takeLast(5) ?: "",
                    style = MaterialTheme.typography.labelSmall, color = TrendAxisColor,
                )
            }
        }
    }
}
