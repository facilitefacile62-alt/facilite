package com.facilite.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.facilite.app.ui.theme.*

enum class NavTab {
    HOME, EXTRACTOR, OFFERS, MESSAGES, NOTIFS, ADMIN
}

@Composable
fun FaciliteBottomNav(
    activeTab: NavTab,
    onTabSelected: (NavTab) -> Unit,
    notifsBadgeCount: String = "8+"
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(CardSurface)
            .padding(horizontal = 4.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.SpaceAround,
        verticalAlignment = Alignment.CenterVertically
    ) {
        NavItem(
            label = "Accueil",
            icon = Icons.Default.Home,
            isActive = activeTab == NavTab.HOME,
            activeColor = MintGreen,
            onClick = { onTabSelected(NavTab.HOME) }
        )

        NavItem(
            label = "Extracteur",
            icon = Icons.Default.Bolt,
            isActive = activeTab == NavTab.EXTRACTOR,
            activeColor = AmberAccent,
            onClick = { onTabSelected(NavTab.EXTRACTOR) }
        )

        NavItem(
            label = "Offres",
            icon = Icons.Default.ListAlt,
            isActive = activeTab == NavTab.OFFERS,
            activeColor = MintGreen,
            onClick = { onTabSelected(NavTab.OFFERS) }
        )

        NavItem(
            label = "Messages",
            icon = Icons.Default.ChatBubbleOutline,
            isActive = activeTab == NavTab.MESSAGES,
            activeColor = MintGreen,
            onClick = { onTabSelected(NavTab.MESSAGES) }
        )

        NavItemWithBadge(
            label = "Notifs",
            icon = Icons.Default.NotificationsNone,
            badge = notifsBadgeCount,
            isActive = activeTab == NavTab.NOTIFS,
            activeColor = MintGreen,
            onClick = { onTabSelected(NavTab.NOTIFS) }
        )

        NavItem(
            label = "Admin",
            icon = Icons.Default.Shield,
            isActive = activeTab == NavTab.ADMIN,
            activeColor = OrangeAdmin,
            defaultColor = OrangeAdmin,
            onClick = { onTabSelected(NavTab.ADMIN) }
        )
    }
}

@Composable
private fun RowScope.NavItem(
    label: String,
    icon: ImageVector,
    isActive: Boolean,
    activeColor: Color = MintGreen,
    defaultColor: Color = TextPrimary,
    onClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .weight(1f)
            .clickable { onClick() }
            .padding(vertical = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(3.dp)
    ) {
        Icon(
            imageVector = icon,
            contentDescription = label,
            tint = if (isActive) activeColor else defaultColor,
            modifier = Modifier.size(19.dp)
        )
        Text(
            text = label,
            fontSize = 10.sp,
            fontWeight = if (isActive) FontWeight.Bold else FontWeight.SemiBold,
            color = if (isActive) activeColor else defaultColor
        )
    }
}

@Composable
private fun RowScope.NavItemWithBadge(
    label: String,
    icon: ImageVector,
    badge: String,
    isActive: Boolean,
    activeColor: Color = MintGreen,
    onClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .weight(1f)
            .clickable { onClick() }
            .padding(vertical = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(3.dp)
    ) {
        Box {
            Icon(
                imageVector = icon,
                contentDescription = label,
                tint = if (isActive) activeColor else TextPrimary,
                modifier = Modifier.size(19.dp)
            )
            if (badge.isNotEmpty()) {
                Box(
                    modifier = Modifier
                        .offset(x = 10.dp, y = (-4).dp)
                        .clip(CircleShape)
                        .background(RedAlert)
                        .padding(horizontal = 4.dp, vertical = 1.dp)
                ) {
                    Text(
                        text = badge,
                        color = Color.White,
                        fontSize = 8.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
        Text(
            text = label,
            fontSize = 10.sp,
            fontWeight = if (isActive) FontWeight.Bold else FontWeight.SemiBold,
            color = if (isActive) activeColor else TextPrimary
        )
    }
}
