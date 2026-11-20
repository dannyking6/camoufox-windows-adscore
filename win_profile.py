#!/usr/bin/env python3
"""
Profil Windows "gagnant" Camoufox — validé contre AdScore (verdict proxy).

Recette (celle qui a passé, voir README):
  - os="windows", canvas_noise=False  (le noise canvas = verdict bot, s35/s36)
  - geoip=True, i_know_what_im_doing=True, UBO exclu
  - locale en-US (voix TTS US cohérentes) + timezone alignée sur l'IP
  - écran 1440x900, prefs anti-https-first/tracking
  - page qui embarque adscore_patch.js AVANT le tag Adscore
  - machine AU REPOS: le temps de création du contexte WebGL doit rester
    < ~120 ms (mesuré 42-67 ms au repos, 122-187 ms sous charge = bot)

Usage:
  python3 win_profile.py https://exemple.com [--click] [--xvfb]
"""
import argparse, asyncio
from camoufox.async_api import AsyncCamoufox
from camoufox.addons import DefaultAddons

async def visit(url, do_click, referer):
    async with AsyncCamoufox(
        headless=False,
        os="windows",
        canvas_noise=False,          # OBLIGATOIRE: noise = incohérence GPU/canvas = bot
        geoip=True,
        i_know_what_im_doing=True,
        exclude_addons=[DefaultAddons.UBO],
        firefox_user_prefs={
            "dom.security.https_first": False,
            "dom.ipc.processCount": 1,
            "privacy.trackingprotection.enabled": False,
            "privacy.trackingprotection.annotate_channels": False,
            "network.cookie.cookieBehavior": 0,
        },
    ) as browser:
        ctx = await browser.new_context(
            viewport={"width": 1440, "height": 900},
            locale="en-US",
            timezone_id="Europe/Brussels",   # aligner sur la geo de l'IP de sortie
        )
        page = await ctx.new_page()
        await page.goto(url, wait_until="domcontentloaded", timeout=90000, referer=referer)
        await page.wait_for_timeout(10_000)
        if do_click:
            await page.mouse.move(700, 400)
            await page.wait_for_timeout(400)
            await page.mouse.click(700, 400)
            await page.wait_for_timeout(8_000)
        await browser.close()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("url")
    ap.add_argument("--click", action="store_true")
    ap.add_argument("--referer", default="https://www.google.com/")
    a = ap.parse_args()
    asyncio.run(visit(a.url, a.click, a.referer))

if __name__ == "__main__":
    main()
