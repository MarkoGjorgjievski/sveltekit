#!/usr/bin/env sh
set -eu

# Git Bash rewrites any argument that looks like a Unix path into a Windows one before the program
# sees it, so `-w /work` reaches Docker as `C:/Program Files/Git/work` and the run dies. These are
# no-ops on Linux and macOS.
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL='*'

# Regenerates the Playwright visual baselines inside the pinned Linux image.
#
# Baselines MUST be produced on the same platform as CI. Font rendering and antialiasing differ
# between Windows and Linux, so a locally generated PNG would never match the CI run.

# The image tag has to track the INSTALLED Playwright, not the range in package.json: ^1.60.0
# currently resolves to 1.62.1, and an image built for another release ships a different Chromium.
VERSION=$(node -p "require('@playwright/test/package.json').version")

# `pwd -W` hands Docker a Windows-style path under Git Bash; plain `pwd` is correct elsewhere.
HOST_DIR=$(pwd -W 2>/dev/null || pwd)

echo "Regenerating baselines in mcr.microsoft.com/playwright:v${VERSION}-noble"

# The anonymous volume over node_modules is load-bearing, not tidiness: without it the container's
# `npm ci` installs Linux binaries into the host's mounted node_modules and breaks the Windows
# toolchain until the next reinstall.
docker run --rm \
  -v "${HOST_DIR}":/work \
  -v /work/node_modules \
  -w /work \
  --ipc=host \
  "mcr.microsoft.com/playwright:v${VERSION}-noble" \
  sh -c "npm ci && npx playwright test visual.e2e.ts --update-snapshots"
