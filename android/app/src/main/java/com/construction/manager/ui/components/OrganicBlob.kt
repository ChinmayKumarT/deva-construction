package com.construction.manager.ui.components

import androidx.compose.foundation.Image
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.res.painterResource
import com.construction.manager.R

// Same blob shape as components/ui/OrganicBlob.tsx on web -- a decorative
// accent, render it behind content (e.g. in a Box), not inline.
@Composable
fun OrganicBlob(modifier: Modifier = Modifier, tint: Color) {
    Image(
        painter = painterResource(R.drawable.organic_blob),
        contentDescription = null,
        modifier = modifier,
        colorFilter = ColorFilter.tint(tint),
    )
}
