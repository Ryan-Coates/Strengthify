package com.strengthify.ui.progress

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.strengthify.data.model.BenchmarkTier
import com.strengthify.data.model.Lift
import com.strengthify.ui.theme.*

@Composable
fun ProgressScreen(
    contentPadding: PaddingValues,
    viewModel: ProgressViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(
                top    = contentPadding.calculateTopPadding() + 16.dp,
                bottom = contentPadding.calculateBottomPadding() + 16.dp,
                start  = 16.dp,
                end    = 16.dp,
            )
    ) {
        Text("Progress", style = MaterialTheme.typography.headlineMedium)
        Spacer(Modifier.height(16.dp))

        // Lift selector tabs
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Lift.entries.forEach { lift ->
                FilterChip(
                    selected = state.selectedLift == lift,
                    onClick  = { viewModel.selectLift(lift) },
                    label    = { Text(lift.displayName.split(" ").first()) },
                )
            }
        }

        Spacer(Modifier.height(16.dp))

        // Stats row
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            StatCard(
                label    = "Best Est. 1RM",
                value    = if (state.personalBestKg > 0f) "${"%.1f".format(state.personalBestKg)} kg" else "—",
                modifier = Modifier.weight(1f),
            )
            StatCard(
                label = "Benchmark",
                value = if (state.benchmarkKg > 0f) "${"%.1f".format(state.benchmarkKg)} kg" else "—",
                modifier = Modifier.weight(1f),
            )
        }

        Spacer(Modifier.height(12.dp))

        // Tier badge
        val tierColor = when (state.tier) {
            BenchmarkTier.BEGINNER     -> Red
            BenchmarkTier.NOVICE       -> Blue
            BenchmarkTier.INTERMEDIATE -> Green
            BenchmarkTier.ADVANCED     -> Yellow
            BenchmarkTier.ELITE        -> Mauve
        }
        Surface(
            shape = RoundedCornerShape(12.dp),
            color = MaterialTheme.colorScheme.surface,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Row(
                modifier = Modifier.padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(state.selectedLift.displayName, style = MaterialTheme.typography.bodyMedium)
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        text       = state.tier.emoji + " " + state.tier.label,
                        color      = tierColor,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        "${state.percentOfBenchmark}% of target",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }

        Spacer(Modifier.height(16.dp))

        // 1RM chart
        Text("Estimated 1RM over time", style = MaterialTheme.typography.titleMedium)
        Spacer(Modifier.height(8.dp))

        if (state.oneRmHistory.size < 2) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(160.dp)
                    .background(MaterialTheme.colorScheme.surface, RoundedCornerShape(12.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    "Log at least 2 sessions to see your trend",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        } else {
            OneRmChart(
                history  = state.oneRmHistory,
                lineColor = Mauve,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(180.dp)
                    .background(MaterialTheme.colorScheme.surface, RoundedCornerShape(12.dp)),
            )
        }
    }
}

@Composable
private fun StatCard(label: String, value: String, modifier: Modifier = Modifier) {
    Card(modifier = modifier) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(label, style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(value, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun OneRmChart(
    history: List<Pair<Int, Float>>,
    lineColor: Color,
    modifier: Modifier = Modifier,
) {
    Canvas(modifier = modifier.padding(16.dp)) {
        if (history.size < 2) return@Canvas

        val maxVal = history.maxOf { it.second }
        val minVal = history.minOf { it.second }.let { if (it == maxVal) 0f else it }
        val range  = (maxVal - minVal).coerceAtLeast(1f)

        val stepX = size.width / (history.size - 1)

        val path = Path()
        history.forEachIndexed { i, (_, oneRm) ->
            val x = i * stepX
            val y = size.height - ((oneRm - minVal) / range) * size.height
            if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
        }

        // Draw line
        drawPath(path, color = lineColor, style = Stroke(width = 3.dp.toPx(), cap = StrokeCap.Round))

        // Draw dots
        history.forEachIndexed { i, (_, oneRm) ->
            val x = i * stepX
            val y = size.height - ((oneRm - minVal) / range) * size.height
            drawCircle(color = lineColor, radius = 5.dp.toPx(), center = Offset(x, y))
        }
    }
}
