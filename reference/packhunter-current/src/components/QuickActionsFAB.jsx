import { useState } from 'react'
import {
  SpeedDial,
  SpeedDialIcon,
  SpeedDialAction,
  Backdrop,
  useTheme,
} from '@mui/material'
import {
  Search as SearchIcon,
  CatchingPokemon as HuntIcon,
  Star as StarIcon,
  Sync as SyncIcon,
  Download as ExportIcon,
  Upload as ImportIcon,
  Analytics as AnalyticsIcon,
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'

const actions = [
  { icon: <HuntIcon />, name: 'Live Hunt', path: '/hunt', color: '#00e676' },
  { icon: <StarIcon />, name: 'God Packs', path: '/godpacks', color: '#ffd700' },
  { icon: <AnalyticsIcon />, name: 'Analytics', path: '/analytics', color: '#03a9f4' },
  { icon: <SearchIcon />, name: 'Search Cards', path: '/cards', color: '#A78BFA' },
  { icon: <SyncIcon />, name: 'Sync Collection', action: 'sync', color: '#4caf50' },
]

function QuickActionsFAB({ onSync }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const theme = useTheme()

  const handleAction = (action) => {
    if (action.path) {
      navigate(action.path)
    } else if (action.action === 'sync' && onSync) {
      onSync()
    }
    setOpen(false)
  }

  return (
    <>
      <Backdrop open={open} sx={{ zIndex: 1200 }} />
      <SpeedDial
        ariaLabel="Quick Actions"
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          '& .MuiFab-primary': {
            background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.light})`,
            '&:hover': {
              background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.secondary.main})`,
            },
          },
        }}
        icon={<SpeedDialIcon />}
        onClose={() => setOpen(false)}
        onOpen={() => setOpen(true)}
        open={open}
      >
        {actions.map((action) => (
          <SpeedDialAction
            key={action.name}
            icon={action.icon}
            tooltipTitle={action.name}
            tooltipOpen
            onClick={() => handleAction(action)}
            sx={{
              '& .MuiSpeedDialAction-fab': {
                background: action.color,
                color: 'white',
                '&:hover': {
                  background: action.color,
                  filter: 'brightness(0.9)',
                },
              },
            }}
          />
        ))}
      </SpeedDial>
    </>
  )
}

export default QuickActionsFAB
