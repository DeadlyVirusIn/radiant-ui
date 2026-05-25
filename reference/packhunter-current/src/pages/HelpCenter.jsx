/**
 * HelpCenter - In-app help and documentation page
 *
 * Features:
 * - Searchable FAQ
 * - Topic categories
 * - Glossary
 * - Quick links
 */

import { useState, useMemo } from 'react'
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  Grid,
  CardActionArea,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Button,
  List,
  ListItem,
  ListItemText,
  Tabs,
  Tab,
  useTheme,
} from '@mui/material'
import {
  Search as SearchIcon,
  ExpandMore as ExpandIcon,
  Link as LinkIcon,
  CatchingPokemon as HuntIcon,
  CardGiftcard as GiftIcon,
  People as FriendsIcon,
  Settings as SettingsIcon,
  Help as HelpIcon,
  School as LearnIcon,
  Book as BookIcon,
  OpenInNew as ExternalIcon,
  Keyboard as KeyboardIcon,
  BugReport as BugIcon,
  QuestionAnswer as FaqIcon,
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { FadeIn } from '../components/Animations'
import { EmptyState } from '../components/EmptyState'
import PageHeader from '../components/PageHeader'
import { useSectionStyles } from '../components/SectionCard'

// FAQ Data
const FAQ_ITEMS = [
  {
    category: 'Getting Started',
    questions: [
      {
        q: 'How do I link my TCG Pocket account?',
        a: 'Go to the Accounts page and click "Link Account". You\'ll need to upload your account.xml and dc.bin files from your device. These files are located in your game\'s data folder.',
      },
      {
        q: 'Where do I find my account.xml and dc.bin files?',
        a: 'On Android, use a file manager with root access to navigate to /data/data/jp.pokemon.pokemontcgp/. The account.xml file is in the shared_prefs folder, and dc.bin is in the files folder.',
      },
      {
        q: 'Is my account data secure?',
        a: 'Yes, your account credentials are encrypted and stored securely. We never share your data with third parties.',
      },
    ],
  },
  {
    category: 'God Pack Hunting',
    questions: [
      {
        q: 'What is a God Pack?',
        a: 'A God Pack is an ultra-rare booster pack where all 5 cards are high-rarity (★★ or better). They occur approximately once every 500 packs.',
      },
      {
        q: 'How long does a hunt take?',
        a: 'Hunt duration depends on the number of accounts and current server conditions. On average, expect 8-12 hours for 100 accounts to complete.',
      },
      {
        q: 'What happens when a God Pack is found?',
        a: 'You\'ll receive a notification (if enabled), and the God Pack details will appear in the Hunt Monitor and God Pack Gallery. The account that found it will be flagged.',
      },
      {
        q: 'Can I hunt for specific cards?',
        a: 'The hunt opens packs randomly. You can choose which expansion to hunt in (Genetic Apex, Mythical Island, etc.), but specific card targeting isn\'t available.',
      },
    ],
  },
  {
    category: 'Trading & Gifting',
    questions: [
      {
        q: 'What is Auto Gift?',
        a: 'Auto Gift lets you request common cards (1D-4D rarity) from the bot pool. When a bot has the card, it will automatically friend you and send the card as a gift.',
      },
      {
        q: 'How long does it take to receive a gifted card?',
        a: 'Most requests are fulfilled within 2-4 hours, depending on card availability. Rare cards may take longer.',
      },
      {
        q: 'What cards can be traded?',
        a: 'You can trade diamond cards (1D-4D), star cards (1★-2★), and shiny cards (1✸-2✸). Crown, immersive, and promo cards cannot be traded.',
      },
      {
        q: 'Why was my gift request cancelled?',
        a: 'Requests can be cancelled if no accounts have the card available, if there\'s a system issue, or if you cancel it manually.',
      },
    ],
  },
  {
    category: 'Account & Settings',
    questions: [
      {
        q: 'How many accounts can I link?',
        a: 'There\'s no hard limit, but we recommend managing a reasonable number to avoid confusion. Premium users may have different limits.',
      },
      {
        q: 'What is account cooldown?',
        a: 'To prevent rate limiting from game servers, accounts need rest periods between automation tasks. Cooldowns typically last 2-4 hours.',
      },
      {
        q: 'How do I enable notifications?',
        a: 'Go to Settings and enable Browser Notifications. Make sure to allow notifications in your browser when prompted.',
      },
    ],
  },
]

// Glossary terms
const GLOSSARY = [
  { term: 'God Pack', definition: 'Ultra-rare pack containing only high-rarity cards (★★ or better).' },
  { term: 'Hunt', definition: 'Automated process of opening packs across multiple accounts to find rare cards.' },
  { term: 'Linked Account', definition: 'A TCG Pocket game account connected to the WebUI for automation.' },
  { term: 'Cooldown', definition: 'Rest period required between automation tasks to prevent rate limiting.' },
  { term: 'Auto Gift', definition: 'Feature that automatically sends common cards to users who request them.' },
  { term: 'Wonder Pick', definition: 'Game feature where you select cards from other players\' recent packs.' },
  { term: 'Bot', definition: 'Automation engine that performs actions on a single account.' },
  { term: '1D-4D', definition: 'Common card rarities (1 diamond to 4 diamonds) that can be gifted.' },
  { term: '★/★★', definition: 'Star card rarities (1-2 stars) that can be traded. 3★ cards cannot be traded.' },
  { term: 'Crown Rare', definition: 'The rarest card type, marked with a crown symbol.' },
]

// Quick links
const QUICK_LINKS = [
  { label: 'Link Account', path: '/accounts', icon: LinkIcon },
  { label: 'Start Hunt', path: '/hunt', icon: HuntIcon },
  { label: 'Request Cards', path: '/auto-gift', icon: GiftIcon },
  { label: 'View Friends', path: '/friends', icon: FriendsIcon },
  { label: 'Settings', path: '/settings', icon: SettingsIcon },
]

// Keyboard shortcuts
const KEYBOARD_SHORTCUTS = [
  { keys: 'Ctrl + K', description: 'Open command palette' },
  { keys: 'Ctrl + /', description: 'Show keyboard shortcuts' },
  { keys: 'Escape', description: 'Close dialogs/modals' },
  { keys: 'G then H', description: 'Go to Home/Dashboard' },
  { keys: 'G then C', description: 'Go to Cards' },
  { keys: 'G then F', description: 'Go to Friends' },
]

export default function HelpCenter() {
  const navigate = useNavigate()
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState(0)
  const [expandedFaq, setExpandedFaq] = useState(null)

  const { sectionBox: cardSx } = useSectionStyles()

  // Filter FAQ by search
  const filteredFaq = useMemo(() => {
    if (!searchQuery) return FAQ_ITEMS

    const query = searchQuery.toLowerCase()
    return FAQ_ITEMS.map(category => ({
      ...category,
      questions: category.questions.filter(
        item =>
          item.q.toLowerCase().includes(query) ||
          item.a.toLowerCase().includes(query)
      ),
    })).filter(category => category.questions.length > 0)
  }, [searchQuery])

  // Filter glossary by search
  const filteredGlossary = useMemo(() => {
    if (!searchQuery) return GLOSSARY

    const query = searchQuery.toLowerCase()
    return GLOSSARY.filter(
      item =>
        item.term.toLowerCase().includes(query) ||
        item.definition.toLowerCase().includes(query)
    )
  }, [searchQuery])

  const totalFaqResults = filteredFaq.reduce((sum, cat) => sum + cat.questions.length, 0)

  return (
    <FadeIn>
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <PageHeader
        icon={<HelpIcon />}
        title="Help Center"
        subtitle="Find answers to common questions and learn how to use features"
      />

      {/* Search */}
      <Box sx={{ ...cardSx, mb: 4, maxWidth: 600 }}>
        <TextField
          fullWidth
          placeholder="Search for help..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        {searchQuery && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Found {totalFaqResults} FAQ results and {filteredGlossary.length} glossary terms
          </Typography>
        )}
      </Box>

      {/* Quick Links */}
      {!searchQuery && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 700 }}>
            Quick Links
          </Typography>
          <Grid container spacing={2}>
            {QUICK_LINKS.map((link) => (
              <Grid item xs={6} sm={4} md={2.4} key={link.path}>
                <Box
                  sx={{
                    ...cardSx,
                    p: 0,
                    overflow: 'hidden',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      borderColor: theme.palette.primary.main,
                    },
                  }}
                >
                  <CardActionArea
                    onClick={() => navigate(link.path)}
                    sx={{ p: 2, textAlign: 'center' }}
                  >
                    <link.icon sx={{ fontSize: 32, color: 'primary.main', mb: 1 }} />
                    <Typography variant="body2" fontWeight="bold">
                      {link.label}
                    </Typography>
                  </CardActionArea>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Tabs */}
      <Box sx={{ ...cardSx, p: 0, mb: 3, overflow: 'hidden' }}>
        <Tabs
          value={activeTab}
          onChange={(e, v) => setActiveTab(v)}
          variant="fullWidth"
        >
          <Tab icon={<FaqIcon />} label="FAQ" iconPosition="start" />
          <Tab icon={<BookIcon />} label="Glossary" iconPosition="start" />
          <Tab icon={<KeyboardIcon />} label="Shortcuts" iconPosition="start" />
        </Tabs>
      </Box>

      {/* FAQ Tab */}
      {activeTab === 0 && (
        <Box>
          {filteredFaq.length === 0 ? (
            <EmptyState
              icon={<SearchIcon />}
              title="No Results"
              description="No FAQ items match your search. Try different keywords."
            />
          ) : (
            filteredFaq.map((category) => (
              <Box key={category.category} sx={{ mb: 3 }}>
                <Typography
                  variant="subtitle1"
                  gutterBottom
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700 }}
                >
                  <LearnIcon color="primary" fontSize="small" />
                  {category.category}
                </Typography>
                {category.questions.map((item, index) => (
                  <Accordion
                    key={index}
                    expanded={expandedFaq === `${category.category}-${index}`}
                    onChange={(e, isExpanded) =>
                      setExpandedFaq(isExpanded ? `${category.category}-${index}` : null)
                    }
                    sx={{
                      mb: 1,
                      borderRadius: '10px !important',
                      border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
                      bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
                      '&:before': { display: 'none' },
                      boxShadow: 'none',
                    }}
                  >
                    <AccordionSummary expandIcon={<ExpandIcon />}>
                      <Typography fontWeight={500}>{item.q}</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Typography color="text.secondary">{item.a}</Typography>
                    </AccordionDetails>
                  </Accordion>
                ))}
              </Box>
            ))
          )}
        </Box>
      )}

      {/* Glossary Tab */}
      {activeTab === 1 && (
        <Box>
          {filteredGlossary.length === 0 ? (
            <EmptyState
              icon={<BookIcon />}
              title="No Results"
              description="No glossary terms match your search."
            />
          ) : (
            <Grid container spacing={2}>
              {filteredGlossary.map((item) => (
                <Grid item xs={12} sm={6} md={4} key={item.term}>
                  <Box
                    sx={{
                      ...cardSx,
                      height: '100%',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        borderColor: theme.palette.primary.main,
                        transform: 'translateY(-2px)',
                      },
                    }}
                  >
                    <Typography variant="subtitle1" fontWeight={700} color="primary" sx={{ mb: 0.5 }}>
                      {item.term}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {item.definition}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}

      {/* Shortcuts Tab */}
      {activeTab === 2 && (
        <Box sx={cardSx}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                bgcolor: `${theme.palette.primary.main}22`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <KeyboardIcon sx={{ color: theme.palette.primary.main, fontSize: 18 }} />
            </Box>
            <Typography variant="subtitle1" fontWeight={700}>
              Keyboard Shortcuts
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Use these keyboard shortcuts to navigate quickly.
          </Typography>
          <List disablePadding>
            {KEYBOARD_SHORTCUTS.map((shortcut) => (
              <ListItem
                key={shortcut.keys}
                divider
                sx={{
                  py: 1.5,
                  '&:last-child': { borderBottom: 'none' },
                  '&:hover': {
                    bgcolor: isDark ? 'rgba(124,138,255,0.04)' : 'rgba(0,0,0,0.02)',
                  },
                }}
              >
                <ListItemText
                  primary={shortcut.description}
                  secondary={
                    <Box sx={{ mt: 0.5 }}>
                      {shortcut.keys.split(' + ').map((key, i, arr) => (
                        <span key={key}>
                          <Chip
                            label={key}
                            size="small"
                            sx={{
                              fontFamily: 'monospace',
                              fontWeight: 'bold',
                              bgcolor: isDark ? 'rgba(124,138,255,0.12)' : 'rgba(0,0,0,0.06)',
                            }}
                          />
                          {i < arr.length - 1 && ' + '}
                        </span>
                      ))}
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {/* Need More Help */}
      <Box sx={{ ...cardSx, mt: 4, textAlign: 'center' }}>
        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 700 }}>
          Need More Help?
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
          Can't find what you're looking for? Join our community or report an issue.
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            startIcon={<ExternalIcon />}
            href="https://discord.gg/your-server"
            target="_blank"
            sx={{ borderRadius: '10px' }}
          >
            Discord Community
          </Button>
          <Button
            variant="outlined"
            startIcon={<BugIcon />}
            href="https://github.com/your-repo/issues"
            target="_blank"
            sx={{ borderRadius: '10px' }}
          >
            Report a Bug
          </Button>
        </Box>
      </Box>
    </Box>
    </FadeIn>
  )
}
