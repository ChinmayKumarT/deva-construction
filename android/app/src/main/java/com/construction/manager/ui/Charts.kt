package com.construction.manager.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
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
