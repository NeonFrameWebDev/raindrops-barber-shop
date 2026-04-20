#!/usr/bin/env bash
# Lure Fishbar static site validator
# Run from project root: ./tests/check.sh

set -u
cd "$(dirname "$0")/.."

pass=0
fail=0
warn=0
PAGES=(index.html services.html 404.html)

ok()   { printf "  \e[32m[ok]\e[0m   %s\n" "$*"; pass=$((pass+1)); }
bad()  { printf "  \e[31m[FAIL]\e[0m %s\n" "$*"; fail=$((fail+1)); }
warn() { printf "  \e[33m[warn]\e[0m %s\n" "$*"; warn=$((warn+1)); }

hdr() { printf "\n\e[1m== %s ==\e[0m\n" "$*"; }

# 1. All expected files exist
hdr "Required files"
for f in "${PAGES[@]}" style.css main.js favicon.svg favicon.ico apple-touch-icon.png site.webmanifest robots.txt sitemap.xml ATTRIBUTIONS.md README.md; do
  [ -f "$f" ] && ok "$f" || bad "missing $f"
done

# 2. No em-dashes or en-dashes anywhere (per NFWD rule)
hdr "No em-dashes or en-dashes"
DASH_HITS=$(grep -nP '[\x{2014}\x{2013}]|&mdash;|&ndash;' "${PAGES[@]}" style.css main.js ATTRIBUTIONS.md 2>/dev/null)
if [ -z "$DASH_HITS" ]; then
  ok "no em/en-dashes in any file"
else
  bad "em/en-dashes found:"
  echo "$DASH_HITS"
fi

# 3. Each page has core meta tags
hdr "Meta tags per page"
for f in "${PAGES[@]}"; do
  grep -q '<title>' "$f" && ok "$f has title" || bad "$f missing title"
  grep -q 'name="description"' "$f" && ok "$f has description" || bad "$f missing description"
  grep -q 'name="viewport"' "$f" && ok "$f has viewport" || bad "$f missing viewport"
done

# 4. All image src references resolve
hdr "Referenced images exist"
BAD_IMG=0
while IFS= read -r src; do
  [ -f "$src" ] || { bad "image missing: $src"; BAD_IMG=1; }
done < <(grep -hoE '(src|background-image|href)=["'\''"](images/[^"'\''"]+)' "${PAGES[@]}" 2>/dev/null | sed -E 's/.*["'\''(]//; s/["'\''"]$//' | sort -u)
# Also check background-image inline url()
while IFS= read -r src; do
  [ -f "$src" ] || { bad "image missing: $src"; BAD_IMG=1; }
done < <(grep -hoE "url\(['\"]?images/[^'\")]+" "${PAGES[@]}" style.css 2>/dev/null | sed -E "s/url\(['\"]?//" | sort -u)
[ "$BAD_IMG" -eq 0 ] && ok "all image references resolve"

# 5. Internal HTML links point to files that exist
hdr "Internal links resolve"
BAD_LINK=0
for f in "${PAGES[@]}"; do
  while IFS= read -r href; do
    case "$href" in
      http*|mailto:*|tel:*|\#*) continue ;;
    esac
    target="${href%%#*}"
    [ -z "$target" ] && continue
    [ -f "$target" ] || { bad "$f: broken link -> $href"; BAD_LINK=1; }
  done < <(grep -hoE 'href="[^"]+"' "$f" | sed 's/href="//; s/"$//')
done
[ "$BAD_LINK" -eq 0 ] && ok "all internal hrefs resolve"

# 6. JSON-LD payloads parse
hdr "JSON-LD validates"
if command -v python3 >/dev/null; then
  for f in "${PAGES[@]}"; do
    python3 - "$f" <<'PY' 2>&1
import sys, re, json
p = sys.argv[1]
txt = open(p).read()
blocks = re.findall(r'<script type="application/ld\+json">([\s\S]*?)</script>', txt)
for i, b in enumerate(blocks):
    try:
        json.loads(b.strip())
        print(f"  [ok]   {p} json-ld block {i+1}")
    except Exception as e:
        print(f"  [FAIL] {p} json-ld block {i+1}: {e}")
PY
  done
fi

# 7. HTML balance (rough): every <div counted against </div>
hdr "HTML tag balance (rough)"
for f in "${PAGES[@]}"; do
  open=$(grep -oE '<(div|section|article|header|footer|main|nav|aside|ul|li|ol|form)\b' "$f" | wc -l)
  close=$(grep -oE '</(div|section|article|header|footer|main|nav|aside|ul|li|ol|form)>' "$f" | wc -l)
  if [ "$open" -eq "$close" ]; then
    ok "$f balanced ($open open, $close close)"
  else
    warn "$f imbalanced open=$open close=$close"
  fi
done

# 8. CSS braces balance
hdr "CSS braces balance"
open=$(grep -o '{' style.css | wc -l)
close=$(grep -o '}' style.css | wc -l)
[ "$open" -eq "$close" ] && ok "style.css braces balanced ($open)" || bad "style.css braces imbalanced $open/$close"

# 9. JS syntax (best-effort via node or python)
hdr "JS syntax check"
if command -v node >/dev/null; then
  node --check main.js 2>&1 && ok "main.js parses" || bad "main.js syntax error"
else
  warn "node not available; skipping JS parse"
fi

# 10. Sitemap has entries for every page
hdr "Sitemap completeness"
for f in "${PAGES[@]}"; do
  case "$f" in
    404.html) continue ;;
  esac
  slug="$f"
  [ "$slug" = "index.html" ] && slug=""
  if grep -q "/$slug\b\|/$slug<" sitemap.xml 2>/dev/null; then
    ok "sitemap has $f"
  else
    warn "sitemap missing $f"
  fi
done

# Summary
hdr "Summary"
printf "  pass: %d  fail: %d  warn: %d\n\n" "$pass" "$fail" "$warn"
[ "$fail" -eq 0 ]
