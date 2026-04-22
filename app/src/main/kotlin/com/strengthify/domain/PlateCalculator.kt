package com.strengthify.domain

/**
 * Calculates which plates to load on each side of the bar for a given target weight.
 *
 * Standard Olympic barbell = 20 kg.
 * Available plates (kg, per side): 25, 20, 15, 10, 5, 2.5, 1.25
 */
object PlateCalculator {

    val STANDARD_BAR_KG = 20f

    private val PLATES_KG = listOf(25f, 20f, 15f, 10f, 5f, 2.5f, 1.25f)

    data class PlateLoadout(
        val platesPerSide: Map<Float, Int>,  // plate weight -> count per side
        val totalWeight: Float,
        val barWeight: Float,
        val remainder: Float,                // weight that couldn't be matched (rounding)
    ) {
        val isExact: Boolean get() = remainder < 0.01f
        val totalPlateWeightPerSide: Float get() = (totalWeight - barWeight) / 2f
    }

    /**
     * @param targetKg  The desired total weight on the bar including the bar itself.
     * @param barKg     Bar weight (default 20 kg).
     */
    fun calculate(targetKg: Float, barKg: Float = STANDARD_BAR_KG): PlateLoadout {
        val weightPerSide = ((targetKg - barKg) / 2f).coerceAtLeast(0f)
        var remaining     = weightPerSide
        val platesPerSide = mutableMapOf<Float, Int>()

        for (plate in PLATES_KG) {
            val count = (remaining / plate).toInt()
            if (count > 0) {
                platesPerSide[plate] = count
                remaining -= count * plate
            }
        }

        val loaded = platesPerSide.entries.fold(0f) { acc, (p, c) -> acc + p * c * 2 }
        return PlateLoadout(
            platesPerSide = platesPerSide,
            totalWeight   = loaded + barKg,
            barWeight     = barKg,
            remainder     = remaining * 2,  // remainder on both sides
        )
    }
}
