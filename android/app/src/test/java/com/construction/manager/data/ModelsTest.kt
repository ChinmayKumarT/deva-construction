package com.construction.manager.data

import io.github.jan.supabase.auth.OtpType
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ModelsTest {

    @Test
    fun `fromString resolves each known role`() {
        assertEquals(Role.admin, Role.fromString("admin"))
        assertEquals(Role.manager, Role.fromString("manager"))
        assertEquals(Role.client, Role.fromString("client"))
        assertEquals(Role.supplier, Role.fromString("supplier"))
        assertEquals(Role.labour, Role.fromString("labour"))
    }

    @Test
    fun `fromString returns null for an unknown or missing role`() {
        assertNull(Role.fromString("owner"))
        assertNull(Role.fromString(""))
        assertNull(Role.fromString(null))
    }

    @Test
    fun `otpTypeFromDeepLinkParam treats magiclink as MAGIC_LINK`() {
        assertEquals(OtpType.Email.MAGIC_LINK, otpTypeFromDeepLinkParam("magiclink"))
    }

    // Recovery is the default for everything else, including older links that
    // predate the `type` query param (see 18_oauth_role_pending.sql's sibling
    // fix, the prefetch-safe confirm page) -- those must still land on the
    // reset-password screen, not silently sign the user in.
    @Test
    fun `otpTypeFromDeepLinkParam defaults to RECOVERY for anything else`() {
        assertEquals(OtpType.Email.RECOVERY, otpTypeFromDeepLinkParam("recovery"))
        assertEquals(OtpType.Email.RECOVERY, otpTypeFromDeepLinkParam(null))
        assertEquals(OtpType.Email.RECOVERY, otpTypeFromDeepLinkParam(""))
        assertEquals(OtpType.Email.RECOVERY, otpTypeFromDeepLinkParam("garbage"))
    }

    // ---------- materialQuickPicks ----------
    // These mirror lib/materialQuickPicks.test.ts case for case. The two
    // implementations must rank the same supplier's chips identically, so a
    // change to one that is not made to the other should fail here.

    private fun cat(name: String, unit: String, cost: Double) =
        SupplierMaterialRow(id = name + unit, supplierId = "s1", name = name, unit = unit, unitCost = cost)

    private fun del(name: String, unit: String, cost: Double) =
        MaterialRow(id = name + unit + cost, name = name, unit = unit, unitCost = cost)

    @Test
    fun `quick picks are empty with no price list and no history`() {
        assertEquals(emptyList<MaterialQuickPick>(), materialQuickPicks(emptyList(), emptyList()))
    }

    @Test
    fun `the price list comes first, alphabetically`() {
        val picks = materialQuickPicks(listOf(cat("Sand", "m3", 1800.0), cat("Cement", "bag", 380.0)), emptyList())
        assertEquals(listOf("Cement", "Sand"), picks.map { it.name })
        assertEquals(true, picks.all { it.fromCatalog })
        assertEquals(380.0, picks[0].unitCost, 0.001)
    }

    @Test
    fun `history is ranked by how often the material was delivered`() {
        val picks = materialQuickPicks(
            emptyList(),
            listOf(del("Sand", "m3", 1800.0), del("Cement", "bag", 380.0), del("Cement", "bag", 375.0), del("Cement", "bag", 370.0)),
        )
        assertEquals(listOf("Cement", "Sand"), picks.map { it.name })
        assertEquals(3, picks[0].count)
        assertEquals(1, picks[1].count)
    }

    // Callers pass history most-recent-first (ordered_at desc).
    @Test
    fun `the rate comes from the most recent delivery`() {
        val picks = materialQuickPicks(emptyList(), listOf(del("Cement", "bag", 400.0), del("Cement", "bag", 380.0)))
        assertEquals(400.0, picks[0].unitCost, 0.001)
    }

    @Test
    fun `a frequency tie is broken in favour of the more recent material`() {
        val picks = materialQuickPicks(emptyList(), listOf(del("Steel", "kg", 62.0), del("Bricks", "nos", 9.0)))
        assertEquals(listOf("Steel", "Bricks"), picks.map { it.name })
    }

    @Test
    fun `differing case and whitespace are the same material`() {
        val picks = materialQuickPicks(emptyList(), listOf(del(" cement ", "Bag", 380.0), del("Cement", "bag", 375.0)))
        assertEquals(1, picks.size)
        assertEquals(2, picks[0].count)
        assertEquals("cement", picks[0].name) // display casing from the most recent row
    }

    @Test
    fun `a material already on the price list is not repeated`() {
        val picks = materialQuickPicks(
            listOf(cat("Cement", "bag", 380.0)),
            listOf(del("CEMENT", "BAG", 999.0), del("Sand", "m3", 1800.0)),
        )
        assertEquals(listOf("Cement", "Sand"), picks.map { it.name })
        assertEquals(380.0, picks[0].unitCost, 0.001) // the agreed rate wins
        assertEquals(false, picks[1].fromCatalog)
    }

    @Test
    fun `the same name in a different unit stays a separate pick`() {
        val picks = materialQuickPicks(emptyList(), listOf(del("Sand", "m3", 1800.0), del("Sand", "trip", 6000.0)))
        assertEquals(2, picks.size)
    }

    @Test
    fun `a blank unit falls back and a nameless row is dropped`() {
        val picks = materialQuickPicks(emptyList(), listOf(del("Cement", "  ", 380.0), del("   ", "bag", 10.0)))
        assertEquals(1, picks.size)
        assertEquals("unit", picks[0].unit)
    }

    @Test
    fun `the list is capped at the limit`() {
        val history = listOf("a", "b", "c", "d", "e").map { del(it, "unit", 1.0) }
        assertEquals(3, materialQuickPicks(emptyList(), history, limit = 3).size)
    }
}
