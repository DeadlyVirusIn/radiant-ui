/**
 * Phase 5.0 (Apr 2026) — Apex Terminal landing page.
 *
 * Public marketing route for the WebUI. Mirrors the approved Launch
 * Experience package:
 *   - Eyebrow: REAL-TIME CONTROL
 *   - Title: Apex Terminal
 *   - Hook: "The control center for TCG Pocket, in real time."
 *   - Sub: "Hunt smarter. Track faster. Share instantly."
 *   - Differentiator: "One system across web and Discord — always in sync."
 *   - Visual: WebUI dashboard mock (left) + Discord embed mock (right) +
 *     "Same data. Two surfaces." connector
 *   - 4-block value strip
 *   - 4-bullet proof row
 *   - Centered final CTA below proof
 *
 * Stack constraints (per project audit):
 *   - No Tailwind. Pure MUI sx + framer-motion.
 *   - Reuses theme.custom.brand.gold / shadows / transitions / radius.
 *   - All buttons type="button" (no form-submit hijack).
 *   - aria-label on icon-only and decorative buttons.
 *   - prefers-reduced-motion respected via theme/globalStyles.js
 *     (Phase 4.8) — entry framer transitions auto-clamp.
 */

'use strict';

import React from 'react';
import {
  Box,
  Typography,
  Button,
  Stack,
  Grid,
  Container,
  useTheme,
} from '@mui/material';
import {
  ArrowForward as ArrowForwardIcon,
  Bolt as BoltIcon,
  AutoAwesome as SparkleIcon,
  VerifiedUser as ShieldIcon,
  ChatBubbleOutline as ChatIcon,
  Speed as SpeedIcon,
  AccessTime as ClockIcon,
  Storage as ServerIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { designTokens } from '../theme/designTokens';

// ── Static config ────────────────────────────────────────────────────

const VALUE_CARDS = [
  {
    Icon: BoltIcon,
    title: 'Real-time intelligence',
    text: 'PPM, trends, and risk surfaced instantly.',
  },
  {
    Icon: SparkleIcon,
    title: 'Full Godpack visibility',
    text: 'Source, members, container, timing, and card art in one view.',
  },
  {
    Icon: ShieldIcon,
    title: 'Explainable Smart Clear',
    text: 'Confidence and reasoning before any friend is removed.',
  },
  {
    Icon: ChatIcon,
    title: 'Discord-ready sharing',
    text: 'Rich embeds that look like product, not log spam.',
  },
];

const PROOF_BULLETS = [
  'Built for scale — 760k+ accounts, indexed read-models',
  'Explainable logic — every disabled action tells you why',
  'Cross-platform parity — web and Discord share the same source-of-truth',
  'Used on 760k+ accounts in production',
];

const GOLD = designTokens.brand.gold;

// ── Sub-components ───────────────────────────────────────────────────

function Eyebrow({ children }) {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        px: 1.5,
        py: 0.5,
        mb: 2,
        borderRadius: 999,
        border: `1px solid ${GOLD}40`,
        bgcolor: `${GOLD}1a`,
      }}
    >
      <Typography
        variant="overline"
        sx={{
          color: GOLD,
          fontWeight: 800,
          letterSpacing: '0.24em',
          fontSize: '0.7rem',
          lineHeight: 1,
        }}
      >
        {children}
      </Typography>
    </Box>
  );
}

function StatusPill({ children, tone = 'green' }) {
  const colors = {
    green:  { bg: 'rgba(52, 211, 153, 0.10)', fg: '#34D399', border: 'rgba(52, 211, 153, 0.28)' },
    gold:   { bg: `${GOLD}1a`,                fg: '#fde68a', border: `${GOLD}40` },
    purple: { bg: 'rgba(167, 139, 250, 0.10)', fg: '#C4B5FD', border: 'rgba(167, 139, 250, 0.28)' },
  };
  const c = colors[tone] || colors.green;
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: 1.25,
        py: 0.4,
        borderRadius: 999,
        border: `1px solid ${c.border}`,
        bgcolor: c.bg,
        color: c.fg,
        fontSize: '0.68rem',
        fontWeight: 700,
        letterSpacing: '0.04em',
      }}
    >
      {children}
    </Box>
  );
}

function GlassCard({ children, sx, ...rest }) {
  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 3,
        border: '1px solid rgba(255, 255, 255, 0.08)',
        bgcolor: 'rgba(13, 17, 28, 0.85)',
        boxShadow: '0 24px 60px -20px rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(8px)',
        ...sx,
      }}
      {...rest}
    >
      {children}
    </Box>
  );
}

function DashboardMock() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      <GlassCard sx={{ p: 2 }}>
        <Box
          sx={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            height: '1px',
            background: `linear-gradient(90deg, transparent, ${GOLD}b3, transparent)`,
          }}
        />
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
          <Box>
            <Typography variant="overline" sx={{ color: `${GOLD}cc`, fontWeight: 800, letterSpacing: '0.22em', lineHeight: 1, fontSize: '0.65rem' }}>
              Web Dashboard
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(148, 163, 184, 0.85)', mt: 0.5 }}>
              NOW / NEXT / RISK
            </Typography>
          </Box>
          <StatusPill tone="green">● Synced 8s ago</StatusPill>
        </Stack>

        <Grid container spacing={1}>
          <Grid item xs={4}>
            <Box sx={{ p: 1.25, borderRadius: 2, border: '1px solid rgba(255,255,255,0.08)', bgcolor: 'rgba(255,255,255,0.03)' }}>
              <Stack direction="row" alignItems="center" spacing={0.75} sx={{ color: 'rgba(148, 163, 184, 0.85)', mb: 0.5 }}>
                <SpeedIcon sx={{ fontSize: 14 }} />
                <Typography variant="caption" sx={{ fontWeight: 600 }}>NOW</Typography>
              </Stack>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#fff', lineHeight: 1.1 }}>402</Typography>
              <Typography variant="caption" sx={{ color: 'rgba(100, 116, 139, 0.95)' }}>PPM live</Typography>
            </Box>
          </Grid>
          <Grid item xs={4}>
            <Box sx={{ p: 1.25, borderRadius: 2, border: '1px solid rgba(255,255,255,0.08)', bgcolor: 'rgba(255,255,255,0.03)' }}>
              <Stack direction="row" alignItems="center" spacing={0.75} sx={{ color: 'rgba(148, 163, 184, 0.85)', mb: 0.5 }}>
                <ClockIcon sx={{ fontSize: 14 }} />
                <Typography variant="caption" sx={{ fontWeight: 600 }}>NEXT</Typography>
              </Stack>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#fff', lineHeight: 1.1 }}>+12%</Typography>
              <Typography variant="caption" sx={{ color: 'rgba(100, 116, 139, 0.95)' }}>trend up</Typography>
            </Box>
          </Grid>
          <Grid item xs={4}>
            <Box sx={{ p: 1.25, borderRadius: 2, border: `1px solid ${GOLD}33`, bgcolor: `${GOLD}10` }}>
              <Stack direction="row" alignItems="center" spacing={0.75} sx={{ color: GOLD, mb: 0.5 }}>
                <ServerIcon sx={{ fontSize: 14 }} />
                <Typography variant="caption" sx={{ fontWeight: 600 }}>RISK</Typography>
              </Stack>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#fff', lineHeight: 1.1 }}>3</Typography>
              <Typography variant="caption" sx={{ color: 'rgba(100, 116, 139, 0.95)' }}>need attention</Typography>
            </Box>
          </Grid>
        </Grid>

        <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 2, border: '1px solid rgba(255,255,255,0.08)', background: 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))' }}>
          <Stack direction="row" justifyContent="space-between" sx={{ color: 'rgba(148, 163, 184, 0.85)' }}>
            <Typography variant="caption">Total Packs</Typography>
            <Typography variant="caption">Success Rate</Typography>
          </Stack>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-end" sx={{ mt: 1 }}>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#fff', lineHeight: 1 }}>1.24M</Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#34D399', lineHeight: 1 }}>98.7%</Typography>
          </Stack>
          <Box
            sx={{
              mt: 1.5,
              height: 40,
              borderRadius: 2,
              background: 'linear-gradient(90deg, rgba(56, 189, 248, 0.25), rgba(167, 139, 250, 0.25), rgba(255, 215, 0, 0.25))',
            }}
          />
        </Box>
      </GlassCard>
    </motion.div>
  );
}

function DiscordMock() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.08, ease: 'easeOut' }}
    >
      <GlassCard sx={{ p: 2, bgcolor: '#111214' }}>
        <Typography variant="overline" sx={{ color: 'rgba(196, 181, 253, 0.85)', fontWeight: 800, letterSpacing: '0.22em', fontSize: '0.65rem' }}>
          Discord Embed
        </Typography>
        <Box
          sx={{
            mt: 1.5,
            p: 2,
            borderRadius: 2,
            borderLeft: `4px solid ${GOLD}`,
            bgcolor: '#2b2d31',
          }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#fff', mb: 1.5 }}>
            ⭐ GOD PACK #121765
          </Typography>
          <Stack spacing={0.6} sx={{ color: 'rgba(226, 232, 240, 0.92)', fontSize: '0.85rem' }}>
            <Box>👤 Togepi342</Box>
            <Box>📦 Fantastical Parade</Box>
            <Box>⚡ Source: Shared Hunt Pool</Box>
            <Box>🖥 Container: 🟧 C3</Box>
            <Box>👥 RhyhornZen, RubyHitosh +4</Box>
          </Stack>
          <Box
            sx={{
              mt: 1.5,
              p: 1.5,
              borderRadius: 1.5,
              bgcolor: 'rgba(0,0,0,0.25)',
              fontSize: '0.75rem',
              lineHeight: 1.7,
              color: 'rgba(226, 232, 240, 0.92)',
            }}
          >
            ✨ Mega Sceptile ex ⭐⭐<br />
            🟣 Mega Lucario ex ⭐⭐<br />
            • Tangela ⭐<br />
            👑 Celebi ⭐⭐
          </Box>
          <Grid container spacing={0.75} sx={{ mt: 1.5 }}>
            {/* Phase 5.0 review fix — replaced "★" with "SAR" so all
                rarity codes are real game labels (SR/AR/SAR/IM/UR). */}
            {['SR', 'AR', 'SAR', 'IM', 'UR'].map((rarity, idx) => (
              <Grid item xs={2.4} key={`${rarity}-${idx}`}>
                <Box
                  sx={{
                    aspectRatio: '2 / 3',
                    borderRadius: 1.25,
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'linear-gradient(180deg, rgba(255, 215, 0, 0.22), rgba(167, 139, 250, 0.12), rgba(15, 23, 42, 1))',
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                    p: 0.5,
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    color: '#fff',
                    boxShadow: '0 6px 12px rgba(0,0,0,0.35)',
                  }}
                >
                  {rarity}
                </Box>
              </Grid>
            ))}
          </Grid>
          {/* Phase 5.0 review fix — "via Apex Terminal ▲" rendered as
              Discord-style bottom footer instead of top pill. Mirrors
              real .setFooter() placement so screenshot expectations
              match production embeds. */}
          <Box
            sx={{
              mt: 1.5,
              pt: 1,
              borderTop: '1px solid rgba(255,255,255,0.06)',
              fontSize: '0.65rem',
              color: 'rgba(148, 163, 184, 0.75)',
              letterSpacing: '0.04em',
            }}
          >
            via Apex Terminal ▲
          </Box>
        </Box>
      </GlassCard>
    </motion.div>
  );
}

// ── Main page ────────────────────────────────────────────────────────

export default function ApexTerminalLanding() {
  const theme = useTheme();
  const navigate = useNavigate();
  // Phase 5.0 — primary CTA goes to root. Auth-aware top-level Routes
  // block in App.jsx will redirect to /login if no session, else land
  // on the dashboard. This avoids hardcoding /dashboard which doesn't
  // exist as a literal route.
  const goToDashboard = () => navigate('/');
  const scrollToVisual = () => {
    const el = document.getElementById('apex-visual');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <Box
      component="main"
      sx={{
        position: 'relative',
        minHeight: '100dvh',
        overflow: 'hidden',
        bgcolor: '#080B12',
        color: '#fff',
      }}
    >
      {/* Ambient gradient blobs */}
      <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <Box sx={{
          position: 'absolute',
          top: '-260px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 820,
          height: 520,
          borderRadius: '50%',
          background: `${GOLD}1a`,
          filter: 'blur(96px)',
        }} />
        <Box sx={{
          position: 'absolute',
          top: '33%',
          right: '-220px',
          width: 520,
          height: 520,
          borderRadius: '50%',
          background: 'rgba(167, 139, 250, 0.10)',
          filter: 'blur(96px)',
        }} />
        <Box sx={{
          position: 'absolute',
          bottom: '-220px',
          left: '-220px',
          width: 520,
          height: 520,
          borderRadius: '50%',
          background: 'rgba(56, 189, 248, 0.10)',
          filter: 'blur(96px)',
        }} />
      </Box>

      <Container maxWidth="xl" sx={{ position: 'relative', py: { xs: 3, md: 5 } }}>
        {/* ── NAV ───────────────────────────────────────────────── */}
        <Box
          component="nav"
          aria-label="Apex Terminal top navigation"
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 1.5,
            borderRadius: 3,
            border: '1px solid rgba(255,255,255,0.08)',
            bgcolor: 'rgba(255,255,255,0.03)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box
              aria-hidden
              sx={{
                width: 36,
                height: 36,
                borderRadius: 2,
                background: `linear-gradient(135deg, #fde68a, ${GOLD})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                color: '#0f172a',
                boxShadow: '0 8px 20px -4px rgba(255,215,0,0.35)',
              }}
            >
              ▲
            </Box>
            <Box>
              <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.04em' }}>
                APEX TERMINAL
              </Typography>
              <Typography sx={{ fontSize: '0.7rem', color: 'rgba(100, 116, 139, 0.95)' }}>
                Web + Discord control surface
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1.5} sx={{ display: { xs: 'none', sm: 'flex' } }}>
            <Button
              type="button"
              onClick={goToDashboard}
              aria-label="Sign in to Apex Terminal"
              sx={{
                color: 'rgba(203, 213, 225, 0.95)',
                textTransform: 'none',
                fontWeight: 500,
                '&:hover': { color: '#fff', bgcolor: 'transparent' },
              }}
            >
              Sign in
            </Button>
            <Button
              type="button"
              onClick={goToDashboard}
              aria-label="Get access to Apex Terminal"
              sx={{
                bgcolor: '#fff',
                color: '#0f172a',
                px: 2,
                py: 1,
                borderRadius: 999,
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '0.85rem',
                transition: 'transform 0.2s ease, background-color 0.2s ease',
                '&:hover': { bgcolor: '#fde68a', transform: 'translateY(-1px)' },
              }}
            >
              Get access
            </Button>
          </Stack>
        </Box>

        {/* ── HERO + VISUAL ─────────────────────────────────────── */}
        <Grid container spacing={4} sx={{ py: { xs: 4, md: 5 }, alignItems: 'center' }}>
          <Grid item xs={12} lg={5}>
            <Box sx={{ maxWidth: 560 }}>
              <Eyebrow>REAL-TIME CONTROL</Eyebrow>
              <Typography
                component="h1"
                sx={{
                  fontSize: { xs: '2.5rem', sm: '3.5rem', lg: '4.25rem' },
                  fontWeight: 700,
                  letterSpacing: '-0.045em',
                  lineHeight: 1.05,
                  color: '#fff',
                  fontFeatureSettings: '"ss01", "ss02"',
                }}
              >
                Apex Terminal
              </Typography>

              {/* Hook (own line) */}
              <Typography
                sx={{
                  mt: 2.5,
                  fontSize: { xs: '1.25rem', sm: '1.5rem' },
                  fontWeight: 600,
                  lineHeight: 1.25,
                  color: 'rgba(226, 232, 240, 0.96)',
                }}
              >
                The control center for TCG Pocket, in real time.
              </Typography>

              {/* Sub (own line — Phase 5.0 review fix #2) */}
              <Typography
                sx={{
                  mt: 2,
                  fontSize: { xs: '1rem', sm: '1.05rem' },
                  lineHeight: 1.6,
                  color: 'rgba(203, 213, 225, 0.92)',
                  maxWidth: 460,
                }}
              >
                Hunt smarter. Track faster. Share instantly.
              </Typography>

              {/* Differentiator (own line — Phase 5.0 review fix #2) */}
              <Typography
                sx={{
                  mt: 1,
                  fontSize: '0.95rem',
                  lineHeight: 1.6,
                  color: 'rgba(148, 163, 184, 0.92)',
                  maxWidth: 460,
                }}
              >
                One system across web and Discord — always in sync.
              </Typography>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 4 }}>
                <Button
                  type="button"
                  onClick={goToDashboard}
                  aria-label="Open dashboard"
                  endIcon={<ArrowForwardIcon className="apex-cta-arrow" sx={{ transition: 'transform 0.2s ease' }} />}
                  sx={{
                    background: `linear-gradient(90deg, #fde68a, ${GOLD})`,
                    color: '#0f172a',
                    px: 3,
                    py: 1.5,
                    borderRadius: 999,
                    fontWeight: 800,
                    fontSize: '0.9rem',
                    textTransform: 'none',
                    boxShadow: '0 18px 32px -8px rgba(255,215,0,0.35)',
                    transition: 'transform 0.2s ease',
                    '&:hover': {
                      background: `linear-gradient(90deg, #fde68a, ${GOLD})`,
                      transform: 'translateY(-1px)',
                    },
                    '&:hover .apex-cta-arrow': { transform: 'translateX(2px)' },
                  }}
                >
                  Open dashboard
                </Button>
                <Button
                  type="button"
                  onClick={scrollToVisual}
                  aria-label="See live demo"
                  sx={{
                    border: '1px solid rgba(255,255,255,0.12)',
                    bgcolor: 'rgba(255,255,255,0.04)',
                    color: '#fff',
                    px: 3,
                    py: 1.5,
                    borderRadius: 999,
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    textTransform: 'none',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
                  }}
                >
                  See live demo
                </Button>
              </Stack>

              {/* Value strip — 4 blocks, hover lift */}
              <Grid container spacing={1.5} sx={{ mt: 4 }}>
                {VALUE_CARDS.map(({ Icon, title, text }) => (
                  <Grid item xs={6} key={title}>
                    <motion.div
                      whileHover={{ y: -2 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                    >
                      <Box
                        sx={{
                          p: 1.5,
                          borderRadius: 2,
                          border: '1px solid rgba(255,255,255,0.08)',
                          bgcolor: 'rgba(255,255,255,0.035)',
                          height: '100%',
                          transition: 'background-color 0.2s ease',
                          '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' },
                        }}
                      >
                        <Icon sx={{ color: GOLD, fontSize: 18, mb: 1 }} />
                        <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>
                          {title}
                        </Typography>
                        <Typography sx={{ fontSize: '0.7rem', color: 'rgba(148, 163, 184, 0.92)', mt: 0.5, lineHeight: 1.45 }}>
                          {text}
                        </Typography>
                      </Box>
                    </motion.div>
                  </Grid>
                ))}
              </Grid>
            </Box>
          </Grid>

          {/* Visual pane — Dashboard + Discord side-by-side */}
          <Grid item xs={12} lg={7} id="apex-visual">
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="center"
              spacing={1.5}
              sx={{
                mb: 2,
                color: 'rgba(148, 163, 184, 0.85)',
                fontSize: '0.7rem',
                fontWeight: 700,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
              }}
            >
              <Box>Same data</Box>
              <Box
                aria-hidden
                sx={{
                  width: 64,
                  height: 1,
                  background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`,
                }}
              />
              <Box>Two surfaces</Box>
            </Stack>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <DashboardMock />
              </Grid>
              <Grid item xs={12} md={6}>
                <DiscordMock />
              </Grid>
            </Grid>
          </Grid>
        </Grid>

        {/* ── PROOF + FINAL CTA (centered, separate row — review fix) ── */}
        <Box
          component="section"
          aria-label="Apex Terminal social proof"
          sx={{
            mt: { xs: 3, md: 4 },
            p: 3,
            borderRadius: 3,
            border: '1px solid rgba(255,255,255,0.08)',
            bgcolor: 'rgba(255,255,255,0.03)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <Grid container spacing={2}>
            {PROOF_BULLETS.map((bullet) => (
              <Grid item xs={12} sm={6} md={3} key={bullet}>
                <Stack direction="row" spacing={1.25} alignItems="flex-start">
                  <Box
                    aria-hidden
                    sx={{
                      mt: 0.7,
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      bgcolor: GOLD,
                      flexShrink: 0,
                    }}
                  />
                  <Typography sx={{ fontSize: '0.8rem', color: 'rgba(203, 213, 225, 0.95)', lineHeight: 1.5 }}>
                    {bullet}
                  </Typography>
                </Stack>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* Phase 5.0 review fix #3 — final CTA standalone + centered. */}
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <Button
            type="button"
            onClick={goToDashboard}
            aria-label="Open dashboard"
            endIcon={<ArrowForwardIcon className="apex-cta-arrow" sx={{ transition: 'transform 0.2s ease' }} />}
            sx={{
              background: `linear-gradient(90deg, #fde68a, ${GOLD})`,
              color: '#0f172a',
              px: 4,
              py: 1.75,
              borderRadius: 999,
              fontWeight: 800,
              fontSize: '0.95rem',
              textTransform: 'none',
              boxShadow: '0 22px 38px -8px rgba(255,215,0,0.45)',
              transition: 'transform 0.2s ease',
              '&:hover': {
                background: `linear-gradient(90deg, #fde68a, ${GOLD})`,
                transform: 'translateY(-1px)',
              },
              '&:hover .apex-cta-arrow': { transform: 'translateX(2px)' },
            }}
          >
            Open dashboard
          </Button>
        </Box>
      </Container>
    </Box>
  );
}
