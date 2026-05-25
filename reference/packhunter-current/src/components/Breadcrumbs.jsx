/**
 * Breadcrumbs - Navigation breadcrumbs for deep pages
 * Auto-generates breadcrumb trail from current route path
 */
import { Link as RouterLink, useLocation } from 'react-router-dom'
import { Breadcrumbs as MuiBreadcrumbs, Link, Typography, Box } from '@mui/material'
import { NavigateNext as SeparatorIcon } from '@mui/icons-material'

// Route label mapping
const routeLabels = {
  '': 'Home',
  'hunt': 'Hunt Monitor',
  'godpacks': 'God Packs',
  'bot-hub': 'Bot Hub',
  'cards': 'Cards',
  'tracker': 'Tracker',
  'card-request': 'Card Requests',
  'wishlist': 'Wishlist',
  'auto-gift': 'Auto Gift',
  'solo-battle': 'Solo Battles',
  'event-battle': 'Event Battles',
  'random-battle': 'Random Battles',
  'friends': 'Friends',
  'missions': 'Missions',
  'presents': 'Present Box',
  'wonder-pick': 'Wonder Pick',
  'open-pack': 'Open Pack',
  'stamina': 'Stamina',
  'shop': 'Item Shop',
  'achievements': 'Achievements',
  'events': 'Events',
  'resources': 'Resources',
  'pack-sim': 'Pack Simulator',
  'accounts': 'Accounts',
  'admin': 'Admin',
  'users': 'Users',
  'analytics': 'Analytics',
  'audit-log': 'Audit Log',
  'scheduler': 'Scheduler',
  'team-logs': 'Activity Logs',
  'settings': 'Settings',
  'profile': 'Profile',
}

// Parent group mapping for top-level pages
const routeGroups = {
  'hunt': 'Hunt',
  'godpacks': 'Hunt',
  'bot-hub': 'Hunt',
  'cards': 'Collection',
  'tracker': 'Collection',
  'card-request': 'Collection',
  'wishlist': 'Hunt',
  'auto-gift': 'Collection',
  'solo-battle': 'Battle',
  'event-battle': 'Battle',
  'random-battle': 'Battle',
  'friends': 'Hunt',
  'missions': 'Activities',
  'presents': 'Activities',
  'wonder-pick': 'Hunt',
  'open-pack': 'Activities',
  'stamina': 'Activities',
  'shop': 'Activities',
  'achievements': 'Activities',
  'events': 'Activities',
  'resources': 'Activities',
  'pack-sim': 'Tools',
  'accounts': 'Tools',
  'users': 'Admin',
  'audit-log': 'Admin',
  'scheduler': 'Admin',
  'team-logs': 'Admin',
  'analytics': 'Admin',
}

export default function Breadcrumbs() {
  const location = useLocation()
  const pathSegments = location.pathname.split('/').filter(Boolean)

  // Don't show on home/dashboard or login
  if (pathSegments.length === 0 || pathSegments[0] === 'login') return null

  const currentRoute = pathSegments[pathSegments.length - 1]
  const group = routeGroups[currentRoute]

  return (
    <Box sx={{ mb: 1, mt: -0.5 }}>
      <MuiBreadcrumbs
        separator={<SeparatorIcon sx={{ fontSize: 16 }} />}
        sx={{
          '& .MuiBreadcrumbs-li': { fontSize: '0.8125rem' },
          '& a': { textDecoration: 'none', '&:hover': { textDecoration: 'underline' } },
        }}
      >
        <Link component={RouterLink} to="/" color="text.secondary" sx={{ fontWeight: 500 }}>
          Home
        </Link>
        {group && (
          <Typography color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
            {group}
          </Typography>
        )}
        <Typography color="text.primary" sx={{ fontSize: '0.8125rem', fontWeight: 600 }}>
          {routeLabels[currentRoute] || currentRoute}
        </Typography>
      </MuiBreadcrumbs>
    </Box>
  )
}
