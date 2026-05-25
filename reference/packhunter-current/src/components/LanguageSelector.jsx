import { useState } from 'react'
import {
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Tooltip,
} from '@mui/material'
import { Language as LanguageIcon } from '@mui/icons-material'
import { useLanguage, languages } from '../contexts/LanguageContext'

function LanguageSelector() {
  const [anchorEl, setAnchorEl] = useState(null)
  const { language, setLanguage } = useLanguage()

  const currentLang = languages.find(l => l.code === language) || languages[0]

  const handleOpen = (event) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleSelect = (langCode) => {
    setLanguage(langCode)
    handleClose()
  }

  return (
    <>
      <Tooltip title={`Language: ${currentLang.name}`}>
        <IconButton
          onClick={handleOpen}
          aria-label={`Change language, currently ${currentLang.name}`}
          sx={{
            color: 'text.secondary',
            '&:hover': { color: 'text.primary' },
          }}
        >
          <Typography sx={{ fontSize: '1.25rem', mr: 0.5 }}>{currentLang.flag}</Typography>
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        PaperProps={{
          sx: {
            mt: 1,
            minWidth: 180,
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          },
        }}
      >
        {languages.map((lang) => (
          <MenuItem
            key={lang.code}
            onClick={() => handleSelect(lang.code)}
            selected={language === lang.code}
          >
            <ListItemIcon>
              <Typography sx={{ fontSize: '1.25rem' }}>{lang.flag}</Typography>
            </ListItemIcon>
            <ListItemText>{lang.name}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}

export default LanguageSelector
