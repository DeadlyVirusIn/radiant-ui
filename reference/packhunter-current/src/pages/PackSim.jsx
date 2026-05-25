import { useState, useEffect } from 'react'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import {
  Box,
  Typography,
  Grid,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  CircularProgress,
  LinearProgress,
  ToggleButton,
  ToggleButtonGroup,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  Slider,
  Alert,
} from '@mui/material'
import {
  CatchingPokemon as PokeballIcon,
  Star as StarIcon,
  Calculate as CalculateIcon,
  Replay as ReplayIcon,
  AutoAwesome as SparkleIcon,
  Functions as MathIcon,
  TrendingUp as TrendingUpIcon,
  Casino as CasinoIcon,
} from '@mui/icons-material'
import { cards as cardsApi, collection as collectionApi } from '../services/api'
import { getCardDisplayName } from '../hooks/useLocalizedCards'
import { useThemeMode } from '../contexts/ThemeContext'
import { FadeIn } from '../components/Animations'
import { EmptyState } from '../components/EmptyState'
import {
  probabilityOfRarityInPacks,
  probabilityOfSpecificCard,
  expectedPacksForRarity,
  expectedPacksForCard,
  probabilityOfGodPack,
  expectedPacksForGodPack,
  monteCarloSetCompletion,
  calculatePackValue,
  calculateLuckRating,
} from '../utils/probabilityUtils'
import { RARITY_COLORS } from '../constants/gameData'
import { getRarityChipTextColor } from '../constants/rarityConfig'
import PageHeader from '../components/PageHeader'
import { useSectionStyles } from '../components/SectionCard'

// Pack configuration (chronological order: oldest to newest)
const PACKS = [
  // A1 - Genetic Apex (Oct 2024)
  { label: "(A1) Genetic Apex Mewtwo", packId: "AN001_0010_00_000", setCode: "A1" },
  { label: "(A1) Genetic Apex Charizard", packId: "AN001_0020_00_000", setCode: "A1" },
  { label: "(A1) Genetic Apex Pikachu", packId: "AN001_0030_00_000", setCode: "A1" },
  // A1a - Mythical Island (Nov 2024)
  { label: "(A1a) Mythical Island", packId: "AN002_0010_00_000", setCode: "A1A" },
  // A2 - Space-Time Smackdown (Jan 2025)
  { label: "(A2) Space-Time Smackdown Dialga", packId: "AN003_0010_00_000", setCode: "A2" },
  { label: "(A2) Space-Time Smackdown Palkia", packId: "AN003_0020_00_000", setCode: "A2" },
  // A2a - Triumphant Light (Feb 2025)
  { label: "(A2a) Triumphant Light", packId: "AN004_0010_00_000", setCode: "A2A" },
  // A2b - Shining Revelry (Mar 2025)
  { label: "(A2b) Shining Revelry", packId: "AN005_0010_00_000", setCode: "A2B" },
  // A3 - Celestial Guardians (Apr 2025)
  { label: "(A3) Celestial Guardians Solgaleo", packId: "AN006_0010_00_000", setCode: "A3" },
  { label: "(A3) Celestial Guardians Lunala", packId: "AN006_0020_00_000", setCode: "A3" },
  // A3a - Extradimensional Crisis (May 2025)
  { label: "(A3a) Extradimensional Crisis", packId: "AN007_0010_00_000", setCode: "A3A" },
  // A3b - Eevee Evolutions (Jun 2025)
  { label: "(A3b) Eevee Evolutions", packId: "AN008_0010_00_000", setCode: "A3B" },
  // A4 - Triumphant Light (Jul 2025)
  { label: "(A4) Triumphant Light Ho-Oh", packId: "AN009_0010_00_000", setCode: "A4" },
  { label: "(A4) Triumphant Light Lugia", packId: "AN009_0020_00_000", setCode: "A4" },
  // A4a - Unknown Depths (Aug 2025)
  { label: "(A4a) Unknown Depths", packId: "AN010_0010_00_000", setCode: "A4A" },
  // A4b - Premium Expansion (Sep 2025)
  { label: "(A4b) Premium Expansion", packId: "AN011_0010_00_000", setCode: "A4B" },
  // B1 - Mega Rising (Oct 2025)
  { label: "(B1) Mega Rising Blaziken", packId: "BN001_0010_00_000", setCode: "B1" },
  { label: "(B1) Mega Rising Gyarados", packId: "BN001_0020_00_000", setCode: "B1" },
  { label: "(B1) Mega Rising Altaria", packId: "BN001_0030_00_000", setCode: "B1" },
  // B1a - Crimson Blaze (Dec 2025)
  { label: "(B1a) Crimson Blaze", packId: "BN002_0010_00_000", setCode: "B1A" },
]

// Rarity probabilities (approximate)
const RARITY_ODDS = {
  'C': 0.60,    // 60% Common
  'U': 0.25,    // 25% Uncommon
  'R': 0.10,    // 10% Rare
  'RR': 0.035,  // 3.5% Double Rare
  'AR': 0.01,   // 1% Art Rare
  'SR': 0.004,  // 0.4% Super Rare
  'SAR': 0.001, // 0.1% Special Art Rare
  'IM': 0.0002, // 0.02% Immersive
  'UR': 0.0001, // 0.01% Ultra Rare
}

// God pack probability
const GOD_PACK_ODDS = 0.0005 // 0.05% chance

function PackSim() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const { isDark } = useThemeMode()
  const [activeTab, setActiveTab] = useState(0) // 0 = Simulator, 1 = Calculator
  const [selectedPack, setSelectedPack] = useState(PACKS[0].packId)
  const [iterations, setIterations] = useState(100)
  const [simulating, setSimulating] = useState(false)
  const [results, setResults] = useState(null)
  const [cardPool, setCardPool] = useState([])

  // Calculator state
  const [calcPacks, setCalcPacks] = useState(100)
  const [calcRarity, setCalcRarity] = useState('SR')
  const [calcCardsInPool, setCalcCardsInPool] = useState(10)
  const [runningMonteCarlo, setRunningMonteCarlo] = useState(false)
  const [monteCarloResults, setMonteCarloResults] = useState(null)
  const [setProgress, setSetProgress] = useState(null)

  // Load cards for selected pack
  useEffect(() => {
    loadCardPool()
  }, [selectedPack])

  const loadCardPool = async () => {
    const pack = PACKS.find(p => p.packId === selectedPack)
    if (!pack) return

    try {
      const data = await cardsApi.list({ limit: 500, set: pack.setCode })
      setCardPool(data.cards || [])
    } catch {
      setCardPool([])
    }
  }

  // Simulate a single card pull
  const simulateSinglePull = () => {
    const rand = Math.random()
    let cumulative = 0

    for (const [rarity, odds] of Object.entries(RARITY_ODDS)) {
      cumulative += odds
      if (rand <= cumulative) {
        // Find a random card of this rarity from pool
        const cardsOfRarity = cardPool.filter(c => c.rarity_code === rarity)
        if (cardsOfRarity.length > 0) {
          return cardsOfRarity[Math.floor(Math.random() * cardsOfRarity.length)]
        }
        return { rarity_code: rarity, card_name: `Simulated ${rarity}`, simulated: true }
      }
    }

    return { rarity_code: 'C', card_name: 'Simulated Common', simulated: true }
  }

  // Simulate a pack (5 cards)
  const simulatePack = () => {
    // Check for god pack
    const isGodPack = Math.random() < GOD_PACK_ODDS

    if (isGodPack) {
      // God pack: all cards are rare or higher
      const rareCards = cardPool.filter(c => ['RR', 'AR', 'SR', 'SAR', 'IM', 'UR'].includes(c.rarity_code))
      const shuffled = [...rareCards].sort(() => 0.5 - Math.random())
      return {
        cards: shuffled.slice(0, 5).map(c => c || { rarity_code: 'RR', card_name: 'Simulated RR' }),
        isGodPack: true,
      }
    }

    // Normal pack: simulate 5 cards
    const cards = []
    for (let i = 0; i < 5; i++) {
      cards.push(simulateSinglePull())
    }

    return { cards, isGodPack: false }
  }

  // Run simulation
  const runSimulation = () => {
    setSimulating(true)
    setResults(null)

    // Use setTimeout to allow UI to update
    setTimeout(() => {
      const stats = {
        totalPacks: iterations,
        totalCards: iterations * 5,
        godPacks: 0,
        rarityCounts: {},
        notableCards: [],
      }

      // Initialize rarity counts
      Object.keys(RARITY_ODDS).forEach(r => {
        stats.rarityCounts[r] = 0
      })

      // Run simulations
      for (let i = 0; i < iterations; i++) {
        const pack = simulatePack()

        if (pack.isGodPack) {
          stats.godPacks++
        }

        pack.cards.forEach(card => {
          stats.rarityCounts[card.rarity_code] = (stats.rarityCounts[card.rarity_code] || 0) + 1

          // Track notable pulls (SR+)
          if (['SR', 'SAR', 'IM', 'UR'].includes(card.rarity_code)) {
            stats.notableCards.push(card)
          }
        })
      }

      // Calculate percentages
      stats.rarityPercentages = {}
      Object.keys(stats.rarityCounts).forEach(r => {
        stats.rarityPercentages[r] = ((stats.rarityCounts[r] / stats.totalCards) * 100).toFixed(2)
      })

      setResults(stats)
      setSimulating(false)
    }, 100)
  }

  // Reset simulation
  const handleReset = () => {
    setResults(null)
  }

  // Load set progress for calculator
  useEffect(() => {
    loadSetProgress()
  }, [])

  const loadSetProgress = async () => {
    try {
      const data = await collectionApi.getSummary()
      setSetProgress(data)
    } catch (error) {
      console.error('Failed to load set progress:', error)
    }
  }

  // Run Monte Carlo simulation
  const runMonteCarlo = () => {
    if (cardPool.length === 0) return
    setRunningMonteCarlo(true)

    setTimeout(() => {
      const results = monteCarloSetCompletion(cardPool, 500)
      setMonteCarloResults(results)
      setRunningMonteCarlo(false)
    }, 100)
  }

  // Calculate probabilities for display
  const probRarity = probabilityOfRarityInPacks(calcRarity, calcPacks) * 100
  const probSpecific = probabilityOfSpecificCard(calcCardsInPool, calcRarity, calcPacks) * 100
  const probGodPack = probabilityOfGodPack(calcPacks) * 100
  const expectedForRarity = expectedPacksForRarity(calcRarity)
  const expectedForCard = expectedPacksForCard(calcCardsInPool, calcRarity)
  const expectedGodPack = expectedPacksForGodPack()

  const { sectionBox } = useSectionStyles()

  return (
    <FadeIn duration={0.4}>
    <Box>
      <PageHeader
        icon={<CasinoIcon />}
        title="Pack Simulator & Calculator"
        subtitle="Simulate pack openings and calculate pull probabilities"
      />

      {/* Tabs */}
      <Box
        sx={{
          mb: 3,
          borderRadius: '14px',
          border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
          bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
          overflow: 'hidden',
        }}
      >
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} variant={isMobile ? 'scrollable' : 'fullWidth'} scrollButtons="auto">
          <Tab icon={<CasinoIcon />} label="Simulator" />
          <Tab icon={<MathIcon />} label="Probability Calculator" />
        </Tabs>
      </Box>

      {/* Simulator Tab */}
      {activeTab === 0 && (
        <>
          {/* Configuration */}
          <Box sx={{ ...sectionBox, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <CasinoIcon sx={{ fontSize: 18, color: theme.palette.primary.main }} />
              <Typography variant="subtitle2" fontWeight={700}>Configuration</Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <FormControl size="small" sx={{ minWidth: 240, flex: 1 }}>
                <InputLabel>Select Pack</InputLabel>
                <Select
                  value={selectedPack}
                  onChange={(e) => setSelectedPack(e.target.value)}
                  label="Select Pack"
                >
                  {PACKS.map((pack) => (
                    <MenuItem key={pack.packId} value={pack.packId}>
                      {pack.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75, fontWeight: 500 }}>
                  Number of Packs
                </Typography>
                <ToggleButtonGroup
                  value={iterations}
                  exclusive
                  onChange={(e, val) => val && setIterations(val)}
                  size="small"
                >
                  <ToggleButton value={10}>10</ToggleButton>
                  <ToggleButton value={100}>100</ToggleButton>
                  <ToggleButton value={500}>500</ToggleButton>
                  <ToggleButton value={1000}>1000</ToggleButton>
                </ToggleButtonGroup>
              </Box>

              <Button
                variant="contained"
                size="large"
                onClick={runSimulation}
                disabled={simulating}
                startIcon={simulating ? <CircularProgress size={18} color="inherit" /> : <CalculateIcon />}
                sx={{
                  py: 1.25,
                  borderRadius: '10px',
                  fontWeight: 700,
                  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                }}
              >
                {simulating ? 'Simulating...' : `Simulate ${iterations} Packs`}
              </Button>
            </Box>
          </Box>

          {/* Results */}
          {results && (
            <>
              {/* Summary metric strip */}
              <Box
                sx={{
                  ...sectionBox,
                  mb: 3,
                  display: 'flex',
                  gap: 0,
                  flexWrap: 'wrap',
                }}
              >
                {[
                  { label: 'Packs Opened', value: results.totalPacks, color: theme.palette.primary.main },
                  { label: 'Total Cards', value: results.totalCards, color: theme.palette.secondary.main },
                  { label: 'God Packs', value: results.godPacks, color: '#ffd700', highlight: results.godPacks > 0 },
                  { label: 'SR+ Pulls', value: results.notableCards.length, color: theme.palette.warning.main },
                ].map((metric, i, arr) => (
                  <Box
                    key={metric.label}
                    sx={{
                      flex: 1,
                      minWidth: 100,
                      textAlign: 'center',
                      px: 2,
                      py: 1,
                      borderRight: i < arr.length - 1
                        ? `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`
                        : 'none',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75 }}>
                      <Typography variant="h4" sx={{ fontWeight: 700, color: metric.color, lineHeight: 1.1 }}>
                        {metric.value}
                      </Typography>
                      {metric.highlight && <SparkleIcon sx={{ color: '#ffd700', fontSize: 20 }} />}
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
                      {metric.label}
                    </Typography>
                  </Box>
                ))}
              </Box>

              {/* Rarity Distribution */}
              <Box sx={{ ...sectionBox, mb: 3 }}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>Rarity Distribution</Typography>
                <TableContainer sx={{ overflowX: 'auto', maxWidth: '100%', '& .MuiTableCell-root': { px: { xs: 1, sm: 1.5, md: 2 }, fontSize: { xs: '0.7rem', sm: '0.875rem' } } }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: isDark ? 'rgba(124, 138, 255, 0.06)' : 'rgba(0,0,0,0.03)' } }}>
                        <TableCell>Rarity</TableCell>
                        <TableCell align="right">Count</TableCell>
                        <TableCell align="right">Pull Rate</TableCell>
                        <TableCell align="right">Expected Rate</TableCell>
                        <TableCell width="40%">Distribution</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Object.entries(results.rarityCounts)
                        .sort((a, b) => b[1] - a[1])
                        .map(([rarity, count]) => (
                          <TableRow key={rarity} sx={{ '&:hover': { bgcolor: isDark ? 'rgba(124, 138, 255, 0.06)' : 'rgba(0,0,0,0.02)' } }}>
                            <TableCell>
                              <Chip
                                label={rarity}
                                size="small"
                                sx={{
                                  bgcolor: RARITY_COLORS[rarity] || '#666',
                                  color: getRarityChipTextColor(rarity),
                                  fontWeight: 600,
                                }}
                              />
                            </TableCell>
                            <TableCell align="right">{count}</TableCell>
                            <TableCell align="right">{results.rarityPercentages[rarity]}%</TableCell>
                            <TableCell align="right">{(RARITY_ODDS[rarity] * 100).toFixed(2)}%</TableCell>
                            <TableCell>
                              <LinearProgress
                                variant="determinate"
                                value={Math.min(100, (count / results.totalCards) * 100 * 10)}
                                sx={{
                                  height: 8,
                                  borderRadius: 4,
                                  bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                                  '& .MuiLinearProgress-bar': {
                                    borderRadius: 4,
                                    background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.light})`,
                                  },
                                }}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>

              {/* Notable Pulls */}
              {results.notableCards.length > 0 && (
                <Box sx={{ ...sectionBox, mb: 3 }}>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>Notable Pulls (SR+)</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {results.notableCards.slice(0, 20).map((card, index) => (
                      <Chip
                        key={index}
                        label={getCardDisplayName(card) || `${card.rarity_code} Card`}
                        size="small"
                        sx={{
                          bgcolor: RARITY_COLORS[card.rarity_code] || '#666',
                          color: getRarityChipTextColor(card.rarity_code),
                        }}
                      />
                    ))}
                    {results.notableCards.length > 20 && (
                      <Chip
                        label={`+${results.notableCards.length - 20} more`}
                        size="small"
                        variant="outlined"
                      />
                    )}
                  </Box>
                </Box>
              )}

              {/* Reset Button */}
              <Box sx={{ textAlign: 'center', mb: 3 }}>
                <Button
                  variant="outlined"
                  startIcon={<ReplayIcon />}
                  onClick={handleReset}
                  sx={{ borderRadius: '8px' }}
                >
                  Reset & Try Again
                </Button>
              </Box>
            </>
          )}

          {/* Info Box */}
          {!results && !simulating && (
            <Box sx={{ ...sectionBox, border: `1px dashed ${theme.palette.primary.main}` }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <PokeballIcon sx={{ color: theme.palette.primary.main, fontSize: 18 }} />
                Simulation Mode
              </Typography>
              <Typography variant="body2" color="text.secondary">
                This simulator uses estimated pack odds to simulate pack openings. No real packs are opened
                and no game data is affected. Use this to get an idea of expected pull rates and god pack
                frequency.
              </Typography>
              <Box sx={{ mt: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  <strong>God Pack Odds:</strong> ~1 in 2000 packs (0.05%) |
                  <strong> UR Odds:</strong> ~1 in 10000 cards (0.01%)
                </Typography>
              </Box>
            </Box>
          )}
        </>
      )}

      {/* Calculator Tab */}
      {activeTab === 1 && (
        <Box>
          {/* Pack Selection for Calculator */}
          <Box sx={{ ...sectionBox, mb: 3 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>Select Pack for Calculations</Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <FormControl size="small" sx={{ minWidth: 240, flex: 1 }}>
                <InputLabel>Pack</InputLabel>
                <Select
                  value={selectedPack}
                  onChange={(e) => setSelectedPack(e.target.value)}
                  label="Pack"
                >
                  {PACKS.map((pack) => (
                    <MenuItem key={pack.packId} value={pack.packId}>
                      {pack.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography variant="caption" color="text.secondary">
                Card pool: <strong>{cardPool.length}</strong> cards
              </Typography>
            </Box>
          </Box>

          {/* Probability Calculator */}
          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            {/* Left Column - Inputs */}
            <Grid item xs={12} md={6}>
              <Box sx={sectionBox}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <MathIcon sx={{ color: theme.palette.primary.main, fontSize: 18 }} />
                  What Are My Odds?
                </Typography>

                {/* Number of Packs */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="body2" gutterBottom sx={{ color: 'text.secondary' }}>
                    Number of Packs: <strong style={{ color: 'inherit' }}>{calcPacks}</strong>
                  </Typography>
                  <Slider
                    value={calcPacks}
                    onChange={(e, v) => setCalcPacks(v)}
                    min={1}
                    max={2000}
                    valueLabelDisplay="auto"
                    sx={{
                      '& .MuiSlider-track': {
                        background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.light})`,
                        border: 'none',
                      },
                    }}
                  />
                  <Box sx={{ display: 'flex', gap: 0.75, mt: 0.5, flexWrap: 'wrap' }}>
                    {[10, 50, 100, 500, 1000].map((v) => (
                      <Button
                        key={v}
                        size="small"
                        variant={calcPacks === v ? 'contained' : 'outlined'}
                        onClick={() => setCalcPacks(v)}
                        sx={{ minWidth: 0, px: 1.25, py: 0.25, fontSize: '0.72rem', borderRadius: '6px' }}
                      >
                        {v}
                      </Button>
                    ))}
                  </Box>
                </Box>

                {/* Target Rarity */}
                <Box sx={{ mb: 3 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Target Rarity</InputLabel>
                    <Select
                      value={calcRarity}
                      onChange={(e) => setCalcRarity(e.target.value)}
                      label="Target Rarity"
                    >
                      {Object.entries(RARITY_ODDS).map(([rarity, odds]) => (
                        <MenuItem key={rarity} value={rarity}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip
                              label={rarity}
                              size="small"
                              sx={{ bgcolor: RARITY_COLORS[rarity], color: getRarityChipTextColor(rarity) }}
                            />
                            <Typography variant="body2">({(odds * 100).toFixed(2)}% per card)</Typography>
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>

                {/* Cards in Pool (for specific card calculations) */}
                <Box sx={{ mb: 1 }}>
                  <Typography variant="body2" gutterBottom sx={{ color: 'text.secondary' }}>
                    Cards of this rarity in set: <strong style={{ color: 'inherit' }}>{calcCardsInPool}</strong>
                  </Typography>
                  <Slider
                    value={calcCardsInPool}
                    onChange={(e, v) => setCalcCardsInPool(v)}
                    min={1}
                    max={50}
                    valueLabelDisplay="auto"
                    sx={{
                      '& .MuiSlider-track': {
                        background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.light})`,
                        border: 'none',
                      },
                    }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    Used to calculate odds of pulling a specific card
                  </Typography>
                </Box>
              </Box>
            </Grid>

            {/* Right Column - Results */}
            <Grid item xs={12} md={6}>
              <Box sx={sectionBox}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <TrendingUpIcon sx={{ color: theme.palette.success.main, fontSize: 18 }} />
                  Probability Results
                </Typography>

                {/* Probability of any card of rarity */}
                <Box sx={{ mb: 2.5, p: 2, bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', borderRadius: '10px' }}>
                  <Typography variant="caption" color="text.secondary">
                    Chance of at least one {calcRarity} in {calcPacks} packs:
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1.2, color: probRarity > 90 ? '#4caf50' : probRarity > 50 ? '#ff9800' : '#f44336' }}>
                    {probRarity.toFixed(2)}%
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(100, probRarity)}
                    sx={{
                      height: 7,
                      borderRadius: 4,
                      mt: 0.75,
                      bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 4,
                        background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.light})`,
                      },
                    }}
                  />
                </Box>

                {/* Probability of specific card */}
                <Box sx={{ mb: 2.5, p: 2, bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', borderRadius: '10px' }}>
                  <Typography variant="caption" color="text.secondary">
                    Chance of a SPECIFIC {calcRarity} card (1 of {calcCardsInPool}):
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1.2, color: probSpecific > 90 ? '#4caf50' : probSpecific > 50 ? '#ff9800' : '#f44336' }}>
                    {probSpecific.toFixed(2)}%
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(100, probSpecific)}
                    sx={{
                      height: 7,
                      borderRadius: 4,
                      mt: 0.75,
                      bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 4,
                        background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.light})`,
                      },
                    }}
                  />
                </Box>

                {/* God Pack probability */}
                <Box sx={{ p: 2, bgcolor: 'rgba(255, 215, 0, 0.08)', borderRadius: '10px', border: '1px solid rgba(255,215,0,0.2)' }}>
                  <Typography variant="caption" color="text.secondary">
                    Chance of at least one God Pack:
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1.2, color: '#ffd700' }}>
                    {probGodPack.toFixed(2)}%
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(100, probGodPack)}
                    sx={{
                      height: 7,
                      borderRadius: 4,
                      mt: 0.75,
                      bgcolor: 'rgba(255, 215, 0, 0.15)',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 4,
                        bgcolor: '#ffd700',
                      },
                    }}
                  />
                </Box>
              </Box>
            </Grid>
          </Grid>

          {/* Expected Packs — compact metric strip */}
          <Box sx={{ ...sectionBox, mb: 2.5 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>Expected Packs Needed</Typography>
            <Box sx={{ display: 'flex', gap: 0, flexWrap: 'wrap' }}>
              {[
                { label: `Packs for any ${calcRarity}`, value: expectedForRarity.toLocaleString(), color: theme.palette.secondary.main },
                { label: `Packs for specific ${calcRarity}`, value: expectedForCard.toLocaleString(), color: theme.palette.primary.main },
                { label: 'Packs for God Pack', value: expectedGodPack.toLocaleString(), color: '#ffd700' },
              ].map((m, i, arr) => (
                <Box
                  key={m.label}
                  sx={{
                    flex: 1,
                    minWidth: 120,
                    textAlign: 'center',
                    p: 2,
                    borderRight: i < arr.length - 1
                      ? `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`
                      : 'none',
                  }}
                >
                  <Typography variant="h3" sx={{ fontWeight: 700, color: m.color, lineHeight: 1.1 }}>
                    {m.value}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
                    {m.label}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>

          {/* Monte Carlo Simulation */}
          <Box sx={{ ...sectionBox, mb: 2.5 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <CasinoIcon sx={{ color: theme.palette.secondary.main, fontSize: 18 }} />
              Set Completion Simulation
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Run 500 simulations to estimate packs needed to complete the selected set.
            </Typography>

            <Button
              variant="contained"
              onClick={runMonteCarlo}
              disabled={runningMonteCarlo || cardPool.length === 0}
              startIcon={runningMonteCarlo ? <CircularProgress size={18} color="inherit" /> : <CalculateIcon />}
              sx={{
                mb: 2,
                borderRadius: '8px',
                fontWeight: 700,
                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
              }}
            >
              {runningMonteCarlo ? 'Running Simulation...' : `Simulate ${PACKS.find(p => p.packId === selectedPack)?.label || 'Pack'}`}
            </Button>

            {monteCarloResults && (
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                {[
                  { label: 'Best Case', value: monteCarloResults.min, color: theme.palette.success.main },
                  { label: '25th %ile', value: monteCarloResults.percentile25, color: 'text.primary' },
                  { label: 'Median', value: monteCarloResults.median, color: theme.palette.primary.main, highlight: true },
                  { label: 'Average', value: monteCarloResults.average, color: 'text.primary' },
                  { label: '75th %ile', value: monteCarloResults.percentile75, color: 'text.primary' },
                  { label: 'Worst Case', value: monteCarloResults.max, color: theme.palette.error.main },
                ].map((m) => (
                  <Box
                    key={m.label}
                    sx={{
                      flex: 1,
                      minWidth: 80,
                      textAlign: 'center',
                      p: 1.5,
                      borderRadius: '10px',
                      border: m.highlight
                        ? `2px solid ${theme.palette.primary.main}`
                        : `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                      bgcolor: m.highlight
                        ? (isDark ? `${theme.palette.primary.main}18` : `${theme.palette.primary.main}0D`)
                        : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'),
                    }}
                  >
                    <Typography variant="h5" sx={{ fontWeight: 700, color: m.color }}>{m.value}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>{m.label}</Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Box>

          {/* Rarity Reference Table */}
          <Box sx={sectionBox}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>Rarity Odds Reference</Typography>
            <TableContainer sx={{ overflowX: 'auto', maxWidth: '100%', '& .MuiTableCell-root': { px: { xs: 1, sm: 1.5, md: 2 }, fontSize: { xs: '0.7rem', sm: '0.875rem' } } }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: isDark ? 'rgba(124, 138, 255, 0.06)' : 'rgba(0,0,0,0.03)' } }}>
                    <TableCell>Rarity</TableCell>
                    <TableCell align="right">Per Card</TableCell>
                    <TableCell align="right">Per Pack (5 cards)</TableCell>
                    <TableCell align="right">Expected Packs</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(RARITY_ODDS).map(([rarity, odds]) => (
                    <TableRow key={rarity} sx={{ '&:hover': { bgcolor: isDark ? 'rgba(124, 138, 255, 0.06)' : 'rgba(0,0,0,0.02)' } }}>
                      <TableCell>
                        <Chip
                          label={rarity}
                          size="small"
                          sx={{ bgcolor: RARITY_COLORS[rarity], color: getRarityChipTextColor(rarity) }}
                        />
                      </TableCell>
                      <TableCell align="right">{(odds * 100).toFixed(3)}%</TableCell>
                      <TableCell align="right">{((1 - Math.pow(1 - odds, 5)) * 100).toFixed(2)}%</TableCell>
                      <TableCell align="right">{expectedPacksForRarity(rarity).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </Box>
      )}
    </Box>
    </FadeIn>
  )
}

export default PackSim
