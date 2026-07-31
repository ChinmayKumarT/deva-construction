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

    @Test
    fun `formatDateTime shows the local date and time for a UTC timestamp`() {
        // Formats in the JVM's default zone -- assert only the parts that
        // don't shift with zone (date order, AM-PM marker), not the exact
        // hour, so this test isn't tied to the CI machine's timezone.
        val out = formatDateTime("2026-07-29T13:22:47.123456+00:00")
        assertEquals(true, out.contains("2026"))
        assertEquals(true, out.contains("29") || out.contains("30"))
        assertEquals(true, out.contains("AM") || out.contains("PM"))
    }

    @Test
    fun `formatDateTime returns the no-date fallback for null`() {
        assertEquals("no date", formatDateTime(null))
    }

    @Test
    fun `formatDateOnly formats a plain date column with no time`() {
        assertEquals("29/7/2026", formatDateOnly("2026-07-29"))
    }

    @Test
    fun `formatDateOnly returns the no-date fallback for null`() {
        assertEquals("no date", formatDateOnly(null))
    }
}
