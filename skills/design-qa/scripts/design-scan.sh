#!/usr/bin/env bash
# design-scan.sh — Ultra-fast design anti-pattern scanner
# Zero dependencies beyond ripgrep (rg). Optional: ast-grep (sg), fd
# Scans a full React/Tailwind project in <0.5 seconds
#
# Usage:
#   bash design-scan.sh [target-dir] [options]
#
# Options:
#   --json           Output JSON (for tooling/dashboards)
#   --fix            Show fix suggestions per issue
#   --critical-only  Only show critical issues
#   --allowlist FILE  Path to allowlist file (one pattern per line to ignore)
#   --no-ui          Skip scanning components/ui/ (they're upstream primitives)

set -euo pipefail

TARGET="${1:-.}"
JSON_MODE=false
FIX_MODE=false
CRITICAL_ONLY=false
SKIP_UI=false
ALLOWLIST=""

for arg in "$@"; do
  case $arg in
    --json) JSON_MODE=true ;;
    --fix) FIX_MODE=true ;;
    --critical-only) CRITICAL_ONLY=true ;;
    --no-ui) SKIP_UI=true ;;
    --allowlist=*) ALLOWLIST="${arg#*=}" ;;
  esac
done

RED='\033[0;31m' YLW='\033[0;33m' GRN='\033[0;32m'
CYN='\033[0;36m' DIM='\033[0;90m' BLD='\033[1m' NC='\033[0m'

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

# Common ripgrep flags — single source of truth
RG_BASE="--line-number --with-filename --no-heading"
RG_GLOBS="--glob=*.tsx --glob=*.jsx --glob=*.ts --glob=*.css --glob=*.scss"
RG_EXCLUDE="--glob=!node_modules/** --glob=!dist/** --glob=!build/** --glob=!.next/** --glob=!*.d.ts --glob=!*.test.* --glob=!*.spec.* --glob=!*.stories.*"
if $SKIP_UI; then
  RG_EXCLUDE="$RG_EXCLUDE --glob=!**/components/ui/**"
fi

# ============================================================
# SCAN GROUPS — all run in parallel, single rg pass each
# ripgrep compiles -e patterns into one automaton = ~same speed as 1 pattern
# ============================================================

# CRITICAL: AI Slop fingerprints
rg $RG_BASE $RG_GLOBS $RG_EXCLUDE \
  -e 'from-purple' -e 'from-violet' -e 'to-blue-\d' -e 'to-cyan-\d' \
  -e 'shadow-glow' -e 'shadow-neon' \
  "$TARGET" 2>/dev/null | sed 's/^/CRITICAL|AI_SLOP|/' > "$TMPDIR/01.txt" &

# CRITICAL: Gradient text (bg-clip-text + text-transparent combo)
rg $RG_BASE $RG_GLOBS $RG_EXCLUDE \
  -e 'bg-clip-text.*text-transparent' \
  -e 'text-transparent.*bg-clip-text' \
  "$TARGET" 2>/dev/null | sed 's/^/CRITICAL|GRADIENT_TEXT|/' > "$TMPDIR/02.txt" &

# HIGH: Hardcoded colors in Tailwind classes
rg $RG_BASE $RG_GLOBS $RG_EXCLUDE \
  -e '(bg|text|border|ring|shadow|outline|fill|stroke)-\[#[0-9a-fA-F]' \
  -e '(bg|text|border|ring)-\[rgb' \
  -e '(bg|text|border|ring)-\[hsl' \
  "$TARGET" 2>/dev/null | sed 's/^/HIGH|HARDCODED_COLOR|/' > "$TMPDIR/03.txt" &

# HIGH: h-screen (iOS Safari broken)
rg $RG_BASE $RG_GLOBS $RG_EXCLUDE \
  -e '\bh-screen\b' -e '\bmin-h-screen\b' \
  "$TARGET" 2>/dev/null | sed 's/^/HIGH|H_SCREEN|/' > "$TMPDIR/04.txt" &

# HIGH: Arbitrary spacing (px values in spacing utilities)
rg $RG_BASE $RG_GLOBS $RG_EXCLUDE \
  -e '[pm][xytblres]-\[\d+px\]' \
  -e 'gap-\[\d+px\]' \
  -e 'space-[xy]-\[\d+px\]' \
  "$TARGET" 2>/dev/null | sed 's/^/HIGH|ARBITRARY_SPACING|/' > "$TMPDIR/05.txt" &

# MEDIUM: Arbitrary font sizes — but allow text-[11px] (micro) and text-[10px] (sub-micro)
# Flag anything else: text-[13px], text-[15px], text-[17px] etc.
rg $RG_BASE $RG_GLOBS $RG_EXCLUDE \
  -e 'text-\[\d+px\]' \
  -e 'text-\[\d+\.?\d*rem\]' \
  "$TARGET" 2>/dev/null | \
  grep -v 'text-\[11px\]' | \
  grep -v 'text-\[10px\]' | \
  grep -v 'text-\[9px\]' | \
  sed 's/^/MEDIUM|ARBITRARY_TYPE|/' > "$TMPDIR/06.txt" &

# MEDIUM: Arbitrary sizing with px
rg $RG_BASE $RG_GLOBS $RG_EXCLUDE \
  -e '[wh]-\[\d+px\]' \
  -e 'size-\[\d+px\]' \
  "$TARGET" 2>/dev/null | sed 's/^/MEDIUM|ARBITRARY_SIZE|/' > "$TMPDIR/07.txt" &

# MEDIUM: Z-index chaos (3+ digit arbitrary z-index)
rg $RG_BASE $RG_GLOBS $RG_EXCLUDE \
  -e 'z-\[\d{3,}\]' \
  "$TARGET" 2>/dev/null | sed 's/^/MEDIUM|Z_INDEX|/' > "$TMPDIR/08.txt" &

# MEDIUM: Animation anti-patterns
rg $RG_BASE $RG_GLOBS $RG_EXCLUDE \
  -e '\banimate-bounce\b' \
  -e '\btransition-all\b' \
  "$TARGET" 2>/dev/null | sed 's/^/MEDIUM|ANIMATION|/' > "$TMPDIR/09.txt" &

# LOW: div/span with onClick (should be button)
rg $RG_BASE --glob='*.tsx' --glob='*.jsx' $RG_EXCLUDE \
  -e '<div[^>]*onClick' \
  -e '<span[^>]*onClick' \
  "$TARGET" 2>/dev/null | sed 's/^/LOW|SEMANTICS|/' > "$TMPDIR/10.txt" &

# Wait for all parallel scans
wait

# ============================================================
# MERGE + ALLOWLIST FILTER
# ============================================================

cat "$TMPDIR"/*.txt 2>/dev/null | sort > "$TMPDIR/raw.txt"

# Apply allowlist if provided (grep -v each pattern)
if [ -n "$ALLOWLIST" ] && [ -f "$ALLOWLIST" ]; then
  grep -v -f "$ALLOWLIST" "$TMPDIR/raw.txt" > "$TMPDIR/all.txt" 2>/dev/null || cp "$TMPDIR/raw.txt" "$TMPDIR/all.txt"
else
  cp "$TMPDIR/raw.txt" "$TMPDIR/all.txt"
fi

# ============================================================
# ast-grep structural scan (optional — if sg is installed)
# ============================================================

if command -v sg &>/dev/null; then
  SGCONFIG="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." 2>/dev/null && pwd)/sgconfig.yml" || true
  if [ -f "$SGCONFIG" ]; then
    sg scan --config "$SGCONFIG" --json "$TARGET" 2>/dev/null | \
      jq -r '.[] | "HIGH|STRUCTURAL|\(.file):\(.range.start.line):\(.message)"' 2>/dev/null | \
      head -50 >> "$TMPDIR/all.txt" || true
  fi
fi

# ============================================================
# COUNT
# ============================================================

TOTAL=$(wc -l < "$TMPDIR/all.txt" | tr -d '[:space:]')
CRITICAL=$(grep -c '^CRITICAL' "$TMPDIR/all.txt" 2>/dev/null | tr -d '[:space:]' || true)
HIGH=$(grep -c '^HIGH' "$TMPDIR/all.txt" 2>/dev/null | tr -d '[:space:]' || true)
MEDIUM=$(grep -c '^MEDIUM' "$TMPDIR/all.txt" 2>/dev/null | tr -d '[:space:]' || true)
LOW=$(grep -c '^LOW' "$TMPDIR/all.txt" 2>/dev/null | tr -d '[:space:]' || true)
: "${CRITICAL:=0}" "${HIGH:=0}" "${MEDIUM:=0}" "${LOW:=0}"

# ============================================================
# FIX SUGGESTIONS MAP
# ============================================================

fix_for() {
  case "$1" in
    AI_SLOP)           echo "Remove gradient. Use flat semantic color tokens." ;;
    GRADIENT_TEXT)      echo "Remove bg-clip-text gradient. Use solid text color." ;;
    HARDCODED_COLOR)    echo "Use semantic token: bg-primary, text-muted-foreground, border-border, etc." ;;
    H_SCREEN)           echo "Replace h-screen with h-dvh (fixes iOS Safari viewport)." ;;
    ARBITRARY_SPACING)  echo "Use spacing scale: gap-2 (8px), gap-4 (16px), or --space-* tokens." ;;
    ARBITRARY_TYPE)     echo "Use type scale: text-xs (12), text-sm (14), text-base (16), text-xl (20)." ;;
    ARBITRARY_SIZE)     echo "Use Tailwind sizing scale or CSS custom properties." ;;
    Z_INDEX)            echo "Use fixed z-index: z-10, z-20, z-30, z-40, z-50." ;;
    ANIMATION)          echo "Replace transition-all with transition-transform or transition-opacity." ;;
    SEMANTICS)          echo "Use <button> for clickable actions. <div onClick> is not keyboard accessible." ;;
    STRUCTURAL)         echo "See ast-grep rule output for specific fix." ;;
    *)                  echo "" ;;
  esac
}

# ============================================================
# OUTPUT
# ============================================================

if $JSON_MODE; then
  # Structured JSON for dashboards/tooling
  echo '{'
  echo '  "target": "'"$TARGET"'",'
  echo '  "total": '$TOTAL','
  echo '  "critical": '$CRITICAL','
  echo '  "high": '$HIGH','
  echo '  "medium": '$MEDIUM','
  echo '  "low": '$LOW','

  # Score: 100 minus weighted deductions, floor at 0
  SCORE=$((100 - CRITICAL * 10 - HIGH * 3 - MEDIUM * 1))
  [ "$SCORE" -lt 0 ] && SCORE=0
  echo '  "score": '$SCORE','

  # Category breakdown
  echo '  "categories": {'
  cut -d'|' -f2 "$TMPDIR/all.txt" | sort | uniq -c | sort -rn | \
    awk 'BEGIN{f=0} {if(f)printf ",\n"; f=1; printf "    \"%s\": %d", $2, $1}' || true
  echo ''
  echo '  },'

  echo '  "issues": ['
  first=true
  while IFS='|' read -r severity category rest; do
    file=$(echo "$rest" | cut -d: -f1)
    lineno=$(echo "$rest" | cut -d: -f2)
    content=$(echo "$rest" | cut -d: -f3- | head -c 200 | sed 's/"/\\"/g; s/\\/\\\\/g')
    $first || echo ","
    first=false
    printf '    {"severity":"%s","category":"%s","file":"%s","line":"%s","content":"%s","fix":"%s"}' \
      "$severity" "$category" "$file" "$lineno" "$content" "$(fix_for "$category")"
  done < "$TMPDIR/all.txt"
  echo ''
  echo '  ]'
  echo '}'

else
  # Terminal output
  echo ""
  echo -e "${BLD}━━━ Design Scan ━━━${NC}"
  echo -e "${DIM}Target: $TARGET${NC}"
  echo ""

  if [ "$TOTAL" -eq 0 ]; then
    echo -e "${GRN}✓ Clean — no design anti-patterns found${NC}"
    echo ""
    exit 0
  fi

  # Score
  SCORE=$((100 - CRITICAL * 10 - HIGH * 3 - MEDIUM * 1))
  [ "$SCORE" -lt 0 ] && SCORE=0
  if [ "$SCORE" -ge 75 ]; then SC="$GRN"
  elif [ "$SCORE" -ge 50 ]; then SC="$YLW"
  else SC="$RED"
  fi

  echo -e "  ${BLD}Score: ${SC}${SCORE}/100${NC}"
  echo -e "  ${RED}Critical: $CRITICAL${NC}  ${YLW}High: $HIGH${NC}  ${DIM}Medium: $MEDIUM  Low: $LOW${NC}"
  echo ""

  # Category breakdown
  echo -e "${BLD}  Categories:${NC}"
  cut -d'|' -f2 "$TMPDIR/all.txt" | sort | uniq -c | sort -rn | while read count cat; do
    echo -e "    ${CYN}$cat${NC} $count"
  done
  echo ""

  # Issues by severity
  for sev in CRITICAL HIGH MEDIUM LOW; do
    if $CRITICAL_ONLY && [ "$sev" != "CRITICAL" ] && [ "$sev" != "HIGH" ]; then continue; fi

    case $sev in
      CRITICAL) color="$RED" ;;
      HIGH) color="$YLW" ;;
      *) color="$DIM" ;;
    esac

    COUNT_FOR_SEV=$(grep -c "^$sev" "$TMPDIR/all.txt" 2>/dev/null || true)
    COUNT_FOR_SEV=$(echo "$COUNT_FOR_SEV" | tr -d '[:space:]')
    : "${COUNT_FOR_SEV:=0}"
    [ "$COUNT_FOR_SEV" -eq 0 ] 2>/dev/null && continue

    local_shown=0
    MAX_SHOW=20

    grep "^$sev" "$TMPDIR/all.txt" | while IFS='|' read -r severity category rest; do
      local_shown=$((local_shown + 1))
      [ "$local_shown" -gt "$MAX_SHOW" ] && { echo -e "  ${DIM}... +$((COUNT_FOR_SEV - MAX_SHOW)) more $sev${NC}"; break; }

      file=$(echo "$rest" | cut -d: -f1)
      lineno=$(echo "$rest" | cut -d: -f2)
      content=$(echo "$rest" | cut -d: -f3- | sed 's/^[[:space:]]*//' | head -c 100)

      echo -e "  ${color}$sev${NC} ${CYN}$category${NC} $file:$lineno"
      echo -e "    ${DIM}$content${NC}"
      if $FIX_MODE; then
        fix=$(fix_for "$category")
        [ -n "$fix" ] && echo -e "    ${GRN}→ $fix${NC}"
      fi
    done
    echo ""
  done

  # Footer
  echo -e "${BLD}━━━${NC}"
  if ! command -v sg &>/dev/null; then
    echo -e "${DIM}  Tip: brew install ast-grep — enables structural checks (nested cards, missing aria)${NC}"
  fi
  echo ""
fi
