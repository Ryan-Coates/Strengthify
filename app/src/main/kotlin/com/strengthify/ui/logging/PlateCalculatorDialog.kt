package com.strengthify.ui.logging

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.text.KeyboardOptions
import com.strengthify.data.model.Lift
import com.strengthify.domain.PlateCalculator
import com.strengthify.ui.theme.Mauve
import com.strengthify.ui.theme.TextSub

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlateCalculatorDialog(
    lift: Lift,
    initialWeight: String,
    onDismiss: () -> Unit,
) {
    var targetInput by remember { mutableStateOf(initialWeight) }
    var barInput    by remember { mutableStateOf("${PlateCalculator.STANDARD_BAR_KG.toInt()}") }

    val target  = targetInput.toFloatOrNull()
    val bar     = barInput.toFloatOrNull() ?: PlateCalculator.STANDARD_BAR_KG
    val loadout = if (target != null && target > bar) PlateCalculator.calculate(target, bar) else null

    AlertDialog(
        onDismissRequest = onDismiss,
        title   = { Text("Plate Calculator — ${lift.displayName}") },
        text    = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value         = targetInput,
                    onValueChange = { targetInput = it },
                    label         = { Text("Target weight (kg)") },
                    singleLine    = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    modifier      = Modifier.fillMaxWidth(),
                )

                OutlinedTextField(
                    value         = barInput,
                    onValueChange = { barInput = it },
                    label         = { Text("Bar weight (kg, default 20)") },
                    singleLine    = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    modifier      = Modifier.fillMaxWidth(),
                )

                if (loadout != null) {
                    HorizontalDivider()
                    Text("Per side:", style = MaterialTheme.typography.titleMedium)

                    if (loadout.platesPerSide.isEmpty()) {
                        Text("Bar only — no plates needed",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                    } else {
                        loadout.platesPerSide.forEach { (plateKg, count) ->
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                            ) {
                                Text("${plateKg}kg",
                                    style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = FontWeight.Medium)
                                Text("× $count",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = Mauve,
                                    fontWeight = FontWeight.Bold)
                            }
                        }
                    }

                    HorizontalDivider()
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Text("Total on bar:", style = MaterialTheme.typography.bodyMedium)
                        Text("${"%.2f".format(loadout.totalWeight)} kg",
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.Bold)
                    }

                    if (!loadout.isExact) {
                        Text(
                            "⚠ Note: ${loadout.remainder.format(2)} kg can't be matched — " +
                                    "use smaller fractional plates.",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.error,
                        )
                    }
                } else if (target != null && target <= bar) {
                    Text("Target must be greater than bar weight.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.error)
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) { Text("Done") }
        },
    )
}

private fun Float.format(decimals: Int) = "%.${decimals}f".format(this)
