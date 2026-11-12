#!/usr/bin/env python3
"""Collect ESPNcricinfo profile IDs from IPL squads, then the IPL Mat total.

Run: python scripts/scrape_appearances.py [--limit N]
Requires Firefox and Selenium, with a compatible geckodriver. Progress is
saved in data/profile_cache.json after every squad and every player. Existing
processed data is never overwritten on failed/ambiguous lookups.
"""
import argparse
import json
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / 'data/profile_cache.json'
DATA = ROOT / 'data/players.json'
BASE = 'https://www.espncricinfo.com'


def save(path, value):
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n')
    temp.replace(path)


def text_key(value):
    return re.sub(r'[^a-z0-9]+', '', value.lower())


def create_driver():
    options = webdriver.FirefoxOptions()
    options.page_load_strategy = 'eager'
    driver = webdriver.Firefox(options=options)
    driver.set_page_load_timeout(60)
    return driver


class AccessDeniedError(RuntimeError):
    pass


def require_access(driver):
    if 'access denied' in driver.title.lower() or 'you don’t have permission to access' in driver.page_source.lower() or "you don't have permission to access" in driver.page_source.lower():
        raise AccessDeniedError('ESPNcricinfo denied access; collection stopped. Existing checkpoints are intact.')


def wait_for_elements(driver, selector):
    def ready(browser):
        require_access(browser)
        elements = browser.find_elements(By.CSS_SELECTOR, selector)
        return elements if elements else False
    return WebDriverWait(driver, 30).until(ready)


def collect_squad_links(driver, season_url):
    driver.get(season_url)
    wait_for_elements(driver, 'a[href*="-squad-"]')
    return sorted({a.get_attribute('href') for a in driver.find_elements(By.CSS_SELECTOR, 'a[href*="-squad-"]') if a.get_attribute('href')})


def collect_profiles(driver, url):
    driver.get(url)
    wait_for_elements(driver, 'a[href*="/cricketers/"]')
    driver.execute_script('window.scrollTo(0, document.body.scrollHeight)')
    time.sleep(1)
    result = {}
    for link in driver.find_elements(By.CSS_SELECTOR, 'a[href*="/cricketers/"]'):
        href = link.get_attribute('href') or ''
        if not re.search(r'/cricketers/[^/?]+-\d+/?$', href):
            continue
        name = link.text.strip().split('\n')[0]
        if name:
            result.setdefault(name, set()).add(href)
    return result


def read_ipl_total(driver, url):
    driver.get(url)
    try:
        wait_for_elements(driver, 'table')
    except AccessDeniedError:
        raise
    except Exception:
        if 'sec-if-cpt-container' in driver.page_source or 'akamai-protected-by' in driver.page_source:
            raise RuntimeError('Player page requires Akamai verification; stop automated collection.')
        raise
    for table in driver.find_elements(By.TAG_NAME, 'table'):
        rows = table.find_elements(By.TAG_NAME, 'tr')
        if not rows:
            continue
        header = [c.text.strip() for c in rows[0].find_elements(By.CSS_SELECTOR, 'th,td')]
        if 'Tournament' not in header or 'Mat' not in header:
            continue
        name_col, mat_col = header.index('Tournament'), header.index('Mat')
        for row in rows[1:]:
            cells = row.find_elements(By.CSS_SELECTOR, 'th,td')
            if len(cells) > max(name_col, mat_col) and cells[name_col].text.strip().split('\n')[0].strip() == 'IPL':
                value = cells[mat_col].text.strip().replace(',', '')
                if value.isdigit():
                    return int(value)
                raise ValueError('IPL row has non-numeric Mat value: ' + value)
    return None  # absent row is not evidence of zero


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--limit', type=int, default=0, help='maximum profile pages this run (0 = all)')
    parser.add_argument('--skip-discovery', action='store_true')
    args = parser.parse_args()
    cache = json.loads(CACHE.read_text()) if CACHE.exists() else {'squads': {}, 'profiles': {}, 'stats': {}}
    seasons = re.findall(r'"(\d{4})"\s*:\s*"([^"]+)"', (ROOT / 'data/seasons.txt').read_text())
    driver = create_driver()
    try:
        if not args.skip_discovery:
            for year, url in seasons:
                try:
                    links = collect_squad_links(driver, url)
                except AccessDeniedError:
                    raise
                except Exception as exc:
                    print(f'{year}: discovery failed: {exc}', flush=True)
                    continue
                for link in links:
                    if link in cache['squads']:
                        continue
                    try:
                        found = collect_profiles(driver, link)
                        if not found:
                            raise ValueError('no player links found')
                        for name, urls in found.items():
                            cache['profiles'].setdefault(name, [])
                            cache['profiles'][name] = sorted(set(cache['profiles'][name]) | urls)
                        cache['squads'][link] = {'season': year, 'players': len(found)}
                        save(CACHE, cache)
                        print(f'{year}: {len(found)} players from {link}', flush=True)
                    except AccessDeniedError:
                        raise
                    except Exception as exc:
                        print(f'{year}: squad failed: {exc}', flush=True)
                    time.sleep(1)
        players = json.loads(DATA.read_text())
        keys = {}
        for name, urls in cache['profiles'].items():
            keys.setdefault(text_key(name), set()).update(urls)
        done = 0
        for player in players:
            urls = keys.get(text_key(player['name']), set())
            if len(urls) != 1:
                continue
            url = next(iter(urls))
            if url not in cache['stats']:
                if args.limit and done >= args.limit:
                    break
                try:
                    count = read_ipl_total(driver, url)
                    cache['stats'][url] = {'appearances': count, 'retrievedAt': datetime.now(timezone.utc).isoformat()}
                    player['profileUrl'] = url
                    player['sourcePlayerId'] = re.search(r'-(\d+)/?$', url).group(1)
                    player['appearances'] = count
                    player['statsRetrievedAt'] = cache['stats'][url]['retrievedAt']
                    save(DATA, players)
                    print(f"{player['name']}: {count if count is not None else 'unknown'}", flush=True)
                    done += 1
                    save(CACHE, cache)
                except AccessDeniedError:
                    raise
                except Exception as exc:
                    print(f"{player['name']}: failed: {exc}", flush=True)
                    if 'Akamai verification' in str(exc):
                        break
                time.sleep(1)
        for player in players:
            urls = keys.get(text_key(player['name']), set())
            if len(urls) == 1:
                url = next(iter(urls))
                player['profileUrl'] = url
                player['sourcePlayerId'] = re.search(r'-(\d+)/?$', url).group(1)
                if url in cache['stats']:
                    player['appearances'] = cache['stats'][url]['appearances']
                    player['statsRetrievedAt'] = cache['stats'][url]['retrievedAt']
        save(DATA, players)
        print(f"Saved data: {sum(p.get('appearances') is not None for p in players)}/{len(players)} players have counts; unresolved names are left unchanged.")
    finally:
        driver.quit()


if __name__ == '__main__':
    try:
        main()
    except AccessDeniedError as exc:
        print(str(exc), flush=True)
        raise SystemExit(1)
