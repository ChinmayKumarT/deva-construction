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
}
