package com.construction.manager.ui

import org.junit.Assert.assertEquals
import org.junit.Test

// Mirrors lib/money.test.ts -- same cases, same expected values, so the two
// platforms' money math is verified to stay identical.
class FormsTest {

    @Test
    fun `rounds a float artifact to a clean 2-decimal value`() {
        // 2.5 * 33.33 = 83.32499999999999 in IEEE-754
        assertEquals(83.32, roundMoney(2.5 * 33.33), 0.0)
    }

    @Test
    fun `resolves the classic 0-1 plus 0-2 drift`() {
        assertEquals(0.3, roundMoney(0.1 + 0.2), 0.0)
    }

    @Test
    fun `rounds a half-paisa up`() {
        assertEquals(1.01, roundMoney(1.005), 0.0)
    }

    @Test
    fun `leaves already-clean values untouched`() {
        assertEquals(1200.0, roundMoney(1200.0), 0.0)
        assertEquals(412.5, roundMoney(412.5), 0.0)
    }

    @Test
    fun `rounds down below the tie`() {
        assertEquals(1.0, roundMoney(1.004), 0.0)
    }

    @Test
    fun `handles zero`() {
        assertEquals(0.0, roundMoney(0.0), 0.0)
    }

    @Test
    fun `lineTotal multiplies quantity by unit cost and rounds to paise`() {
        assertEquals(83.32, lineTotal(2.5, 33.33), 0.0)
    }

    @Test
    fun `lineTotal is exact for whole quantities`() {
        assertEquals(7500.0, lineTotal(20.0, 375.0), 0.0)
    }

    @Test
    fun `lineTotal returns 0 for a zero quantity`() {
        assertEquals(0.0, lineTotal(0.0, 999.99), 0.0)
    }

    // present=1.0, half_day=0.5, absent=0.0 -- the same weighting used by
    // AdminScreens.kt's ReportWageFactor and lib/wages.ts's WAGE_FACTOR.
    @Test
    fun `wage weighting matches present-half-absent factors`() {
        val dailyWage = 833.33
        assertEquals(833.33, roundMoney(1.0 * dailyWage), 0.0)
        assertEquals(416.67, roundMoney(0.5 * dailyWage), 0.0)
        assertEquals(0.0, roundMoney(0.0 * dailyWage), 0.0)
    }
}
