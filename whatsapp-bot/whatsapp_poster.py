"""
whatsapp_poster.py - Sarkari Sahayak WhatsApp Channel Auto-Poster
==================================================================
Sarkari Sahayak website ke JSON data se nayi entries detect karke
automatically WhatsApp Channel pe post karta hai.

Features:
- Latest Jobs, Results, Admit Cards, Yojana - sab auto-post
- Duplicate prevention (posted_ids.json tracker)
- Beautiful Hindi + English formatted messages
- Green-API (free tier) via REST

Usage:
    python whatsapp_poster.py                  # Normal run
    python whatsapp_poster.py --test           # Test message only
    python whatsapp_poster.py --dry-run        # Dry run (no actual post)
    python whatsapp_poster.py --category jobs  # Only jobs
"""

import json
import os
import sys
import time
import re
import argparse
import urllib.request
import urllib.parse
import urllib.error
from datetime import datetime, date
from pathlib import Path

# Force UTF-8 output on Windows (emoji support)
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

# ─── Configuration ────────────────────────────────────────────────────────────

# Green-API credentials (GitHub Secrets se aayenge)
GREENAPI_ID_INSTANCE    = os.environ.get("GREENAPI_ID_INSTANCE", "").strip()
GREENAPI_API_TOKEN      = os.environ.get("GREENAPI_API_TOKEN", "").strip()

# WhatsApp Channel ID (format: 0029Va...@newsletter)
WHATSAPP_CHANNEL_ID     = os.environ.get("WHATSAPP_CHANNEL_ID", "").strip()

# Website base URL
SITE_BASE_URL = "https://sarkarisahayak.in"

# Data file paths (relative to project root)
ROOT = Path(__file__).parent.parent
DATA_DIR = ROOT / "src" / "data"

DATA_FILES = {
    "jobs":        DATA_DIR / "latest-jobs.json",
    "results":     DATA_DIR / "results.json",
    "admit_cards": DATA_DIR / "admit-cards.json",
    "yojana":      DATA_DIR / "yojana.json",
}

# Posted IDs tracker file
POSTED_IDS_FILE = Path(__file__).parent / "posted_ids.json"

# How many new entries to post per run (avoid spam)
MAX_POSTS_PER_RUN = int(os.environ.get("MAX_POSTS_PER_RUN", "3"))

# Delay between messages (seconds) — avoid WhatsApp rate limits
POST_DELAY_SECONDS = int(os.environ.get("POST_DELAY_SECONDS", "5"))

# How many days old entries to consider "new" (prevents old data from being posted)
MAX_AGE_DAYS = int(os.environ.get("MAX_AGE_DAYS", "3"))

# ─── Emoji & Category Config ──────────────────────────────────────────────────

CATEGORY_CONFIG = {
    "jobs": {
        "emoji":   "🔴",
        "heading": "नई सरकारी नौकरी | New Sarkari Job",
        "icon":    "💼",
        "url_path": "latest-jobs",
        "tag":     "#SarkariNaukri #GovtJob",
    },
    "results": {
        "emoji":   "🟢",
        "heading": "परिणाम जारी | Result Declared",
        "icon":    "📋",
        "url_path": "results",
        "tag":     "#SarkariResult #Result",
    },
    "admit_cards": {
        "emoji":   "🟡",
        "heading": "एडमिट कार्ड जारी | Admit Card Out",
        "icon":    "🎫",
        "url_path": "admit-cards",
        "tag":     "#AdmitCard #HallTicket",
    },
    "yojana": {
        "emoji":   "🔵",
        "heading": "सरकारी योजना | Govt Scheme",
        "icon":    "🏛️",
        "url_path": "yojana",
        "tag":     "#SarkariYojana #GovtScheme",
    },
}

ORG_EMOJI_MAP = {
    "ssc": "📊", "upsc": "🏛️", "railway": "🚂", "rrb": "🚂",
    "bank": "🏦", "sbi": "🏦", "ibps": "🏦", "police": "👮",
    "army": "⚔️", "navy": "⚓", "air force": "✈️", "defence": "⚔️",
    "health": "🏥", "teacher": "📚", "teaching": "📚", "vidyalaya": "📚",
    "neet": "🔬", "jee": "🔬", "state": "🏛️",
}

# ─── Helper Functions ─────────────────────────────────────────────────────────

def log(msg: str, level: str = "INFO"):
    """Timestamped logger."""
    ts = datetime.now().strftime("%H:%M:%S")
    prefix = {"INFO": "ℹ️", "OK": "✅", "WARN": "⚠️", "ERROR": "❌", "POST": "📤"}.get(level, "•")
    print(f"[{ts}] {prefix} {msg}")


def load_json(filepath: Path, fallback=None):
    """Safely load a JSON file."""
    if fallback is None:
        fallback = []
    try:
        if filepath.exists():
            content = filepath.read_text(encoding="utf-8-sig")
            return json.loads(content)
    except Exception as e:
        log(f"Error reading {filepath.name}: {e}", "ERROR")
    return fallback


def save_json(filepath: Path, data):
    """Safely save a JSON file."""
    try:
        filepath.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    except Exception as e:
        log(f"Error saving {filepath.name}: {e}", "ERROR")


def load_posted_ids() -> dict:
    """Load already-posted IDs tracker."""
    data = load_json(POSTED_IDS_FILE, fallback={})
    if not isinstance(data, dict):
        return {"jobs": [], "results": [], "admit_cards": [], "yojana": []}
    # Ensure all keys exist
    for k in CATEGORY_CONFIG:
        data.setdefault(k, [])
    return data


def save_posted_ids(posted: dict):
    """Save posted IDs tracker."""
    save_json(POSTED_IDS_FILE, posted)
    log(f"Saved posted_ids.json", "OK")


def strip_html(text: str) -> str:
    """Remove HTML tags from string."""
    if not text:
        return ""
    clean = re.sub(r"<[^>]+>", "", str(text))
    clean = re.sub(r"\s+", " ", clean).strip()
    return clean


def is_recent(date_str: str, max_days: int = MAX_AGE_DAYS) -> bool:
    """Check if a date string is within the last N days."""
    if not date_str or date_str in ("To be announced", "Check Notification", ""):
        return True  # Unknown date — include it
    try:
        d = datetime.strptime(date_str[:10], "%Y-%m-%d").date()
        delta = (date.today() - d).days
        return delta <= max_days
    except (ValueError, TypeError):
        return True


def get_org_emoji(org_name: str) -> str:
    """Get relevant emoji for an organisation."""
    if not org_name:
        return "🏛️"
    lower = org_name.lower()
    for keyword, emoji in ORG_EMOJI_MAP.items():
        if keyword in lower:
            return emoji
    return "🏛️"


def truncate(text: str, max_len: int = 60) -> str:
    """Truncate text to max_len characters."""
    if not text:
        return ""
    text = strip_html(text)
    return text[:max_len].rstrip() + ("…" if len(text) > max_len else "")

# ─── Message Formatters ───────────────────────────────────────────────────────

def format_job_message(item: dict) -> str:
    """Format a jobs entry into WhatsApp message."""
    cfg = CATEGORY_CONFIG["jobs"]
    org = item.get("organization", "Govt of India")
    title = truncate(item.get("title", "Sarkari Job"), 70)
    vacancies = item.get("vacancies", "")
    last_date = item.get("lastDate", "Check Notification")
    qualify = item.get("qualify", "")
    salary = item.get("salary", "")
    slug = item.get("slug", "")
    org_emoji = get_org_emoji(org)

    vac_line = f"👥 *Vacancies:* {vacancies}\n" if vacancies else ""
    qual_line = f"🎓 *Qualification:* {truncate(qualify, 50)}\n" if qualify else ""
    sal_line  = f"💰 *Salary:* {truncate(salary, 50)}\n" if salary else ""
    last_line = f"📅 *Last Date:* {last_date}\n" if last_date else ""

    url = f"{SITE_BASE_URL}/latest-jobs/{slug}" if slug else SITE_BASE_URL + "/latest-jobs"

    msg = (
        f"{cfg['emoji']} *{cfg['heading']}*\n"
        f"{'━' * 30}\n\n"
        f"{org_emoji} *{title}*\n\n"
        f"🏛️ *Org:* {org}\n"
        f"{vac_line}"
        f"{last_line}"
        f"{qual_line}"
        f"{sal_line}\n"
        f"🔗 *Full Details & Apply:*\n{url}\n\n"
        f"{'━' * 30}\n"
        f"📲 *Sarkari Sahayak* — सरकारी नौकरी की सच्ची जानकारी\n"
        f"{cfg['tag']} #SarkariSahayak"
    )
    return msg


def format_result_message(item: dict) -> str:
    """Format a results entry into WhatsApp message."""
    cfg = CATEGORY_CONFIG["results"]
    org = item.get("organization", "Govt of India")
    title = truncate(item.get("title", "Sarkari Result"), 70)
    slug = item.get("slug", "")
    release_date = item.get("releaseDate", "")
    status = item.get("status", "")

    url = f"{SITE_BASE_URL}/results/{slug}" if slug else SITE_BASE_URL + "/results"
    date_line = f"📅 *Released:* {release_date}\n" if release_date else ""
    status_line = f"📌 *Status:* {status}\n" if status else ""

    msg = (
        f"{cfg['emoji']} *{cfg['heading']}*\n"
        f"{'━' * 30}\n\n"
        f"📋 *{title}*\n\n"
        f"🏛️ *Org:* {org}\n"
        f"{date_line}"
        f"{status_line}\n"
        f"🔗 *Result Link:*\n{url}\n\n"
        f"{'━' * 30}\n"
        f"📲 *Sarkari Sahayak* — सरकारी नौकरी की सच्ची जानकारी\n"
        f"{cfg['tag']} #SarkariSahayak"
    )
    return msg


def format_admit_card_message(item: dict) -> str:
    """Format an admit card entry into WhatsApp message."""
    cfg = CATEGORY_CONFIG["admit_cards"]
    org = item.get("organization", "Govt of India")
    title = truncate(item.get("title", "Admit Card"), 70)
    slug = item.get("slug", "")
    release_date = item.get("releaseDate", "")
    status = item.get("status", "")

    url = f"{SITE_BASE_URL}/admit-cards/{slug}" if slug else SITE_BASE_URL + "/admit-cards"
    date_line = f"📅 *Released:* {release_date}\n" if release_date else ""

    msg = (
        f"{cfg['emoji']} *{cfg['heading']}*\n"
        f"{'━' * 30}\n\n"
        f"🎫 *{title}*\n\n"
        f"🏛️ *Org:* {org}\n"
        f"{date_line}"
        f"✅ *Status:* {status or 'Available Now'}\n\n"
        f"🔗 *Download Admit Card:*\n{url}\n\n"
        f"{'━' * 30}\n"
        f"📲 *Sarkari Sahayak* — सरकारी नौकरी की सच्ची जानकारी\n"
        f"{cfg['tag']} #SarkariSahayak"
    )
    return msg


def format_yojana_message(item: dict) -> str:
    """Format a yojana/scheme entry into WhatsApp message."""
    cfg = CATEGORY_CONFIG["yojana"]
    name = truncate(item.get("name", "Sarkari Yojana"), 70)
    ministry = item.get("ministry", "Government of India")
    eligibility = truncate(strip_html(item.get("eligibility", "")), 80)
    benefits_raw = item.get("benefits", "")
    benefits = truncate(strip_html(benefits_raw), 80) if benefits_raw else ""
    slug = item.get("slug", "")

    url = f"{SITE_BASE_URL}/yojana/{slug}" if slug else SITE_BASE_URL + "/yojana"
    elig_line = f"✅ *Eligibility:* {eligibility}\n" if eligibility else ""
    ben_line  = f"🎁 *Benefits:* {benefits}\n" if benefits else ""

    msg = (
        f"{cfg['emoji']} *{cfg['heading']}*\n"
        f"{'━' * 30}\n\n"
        f"🏛️ *{name}*\n\n"
        f"🏢 *Ministry:* {ministry}\n"
        f"{elig_line}"
        f"{ben_line}\n"
        f"🔗 *Full Details:*\n{url}\n\n"
        f"{'━' * 30}\n"
        f"📲 *Sarkari Sahayak* — सरकारी नौकरी की सच्ची जानकारी\n"
        f"{cfg['tag']} #SarkariSahayak"
    )
    return msg


def format_message(category: str, item: dict) -> str:
    """Route to correct message formatter."""
    formatters = {
        "jobs":        format_job_message,
        "results":     format_result_message,
        "admit_cards": format_admit_card_message,
        "yojana":      format_yojana_message,
    }
    return formatters[category](item)

# ─── Green-API Sender ─────────────────────────────────────────────────────────

def send_whatsapp_message(message: str, dry_run: bool = False) -> bool:
    """
    Send a message to WhatsApp Channel using Green-API.
    Returns True on success, False on failure.
    """
    if dry_run:
        log(f"[DRY RUN] Would send:\n{message[:200]}…", "INFO")
        return True

    if not all([GREENAPI_ID_INSTANCE, GREENAPI_API_TOKEN, WHATSAPP_CHANNEL_ID]):
        log("Missing Green-API credentials! Set env vars: GREENAPI_ID_INSTANCE, GREENAPI_API_TOKEN, WHATSAPP_CHANNEL_ID", "ERROR")
        return False

    url = (
        f"https://api.green-api.com/waInstance{GREENAPI_ID_INSTANCE}"
        f"/sendMessage/{GREENAPI_API_TOKEN}"
    )

    payload = json.dumps({
        "chatId": WHATSAPP_CHANNEL_ID,
        "message": message,
    }).encode("utf-8")

    try:
        req = urllib.request.Request(
            url,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read().decode("utf-8")
            result = json.loads(body)
            if result.get("idMessage"):
                log(f"Message sent! ID: {result['idMessage']}", "POST")
                return True
            else:
                log(f"Unexpected response: {body}", "WARN")
                return False
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8") if e.fp else ""
        log(f"HTTP {e.code} error: {err_body}", "ERROR")
        return False
    except Exception as e:
        log(f"Send failed: {e}", "ERROR")
        return False


def send_test_message(dry_run: bool = False) -> bool:
    """Send a test message to verify setup."""
    now = datetime.now().strftime("%d %b %Y, %I:%M %p")
    msg = (
        f"✅ *Sarkari Sahayak Bot — Test Message*\n"
        f"{'━' * 30}\n\n"
        f"🎉 Bot successfully connected!\n\n"
        f"🕐 *Time:* {now}\n"
        f"🤖 *Status:* Active & Running\n\n"
        f"Aapke WhatsApp Channel pe ab automatic posts aane shuru ho jayenge:\n"
        f"• 💼 Naukri (Latest Jobs)\n"
        f"• 📋 Result (Sarkari Results)\n"
        f"• 🎫 Admit Card\n"
        f"• 🏛️ Yojana (Govt Schemes)\n\n"
        f"{'━' * 30}\n"
        f"📲 *Sarkari Sahayak Bot* 🤖\n"
        f"https://sarkarisahayak.in"
    )
    log("Sending test message…", "INFO")
    return send_whatsapp_message(msg, dry_run=dry_run)

# ─── Main Logic ───────────────────────────────────────────────────────────────

def get_new_entries(
    category: str,
    items: list,
    posted_ids: list,
) -> list:
    """
    Return new entries not yet posted.
    Filters by age (MAX_AGE_DAYS) and deduplication via posted_ids.
    """
    new = []
    for item in items:
        slug = item.get("slug") or item.get("name", "")
        if not slug:
            continue
        if slug in posted_ids:
            continue

        # Check date freshness
        date_field = (
            item.get("postDate")
            or item.get("releaseDate")
            or item.get("launchDate")
            or item.get("startDate")
            or ""
        )
        if not is_recent(date_field):
            continue

        new.append(item)
    return new


def run_bot(
    categories: list | None = None,
    dry_run: bool = False,
    test: bool = False,
):
    """Main bot execution."""
    log("=" * 50, "INFO")
    log("🤖 Sarkari Sahayak WhatsApp Bot Starting…", "INFO")
    log(f"Mode: {'DRY RUN' if dry_run else 'LIVE'} | Max posts/run: {MAX_POSTS_PER_RUN}", "INFO")
    log("=" * 50, "INFO")

    # Test message mode
    if test:
        ok = send_test_message(dry_run=dry_run)
        sys.exit(0 if ok else 1)

    posted = load_posted_ids()
    categories = categories or list(CATEGORY_CONFIG.keys())
    total_posted = 0

    for category in categories:
        if total_posted >= MAX_POSTS_PER_RUN:
            log(f"Reached max posts per run ({MAX_POSTS_PER_RUN}). Stopping.", "WARN")
            break

        data_file = DATA_FILES.get(category)
        if not data_file or not data_file.exists():
            log(f"Data file not found for '{category}': {data_file}", "WARN")
            continue

        log(f"Checking {category}…", "INFO")
        items = load_json(data_file)

        if not isinstance(items, list):
            log(f"Unexpected data format in {data_file.name}", "WARN")
            continue

        new_entries = get_new_entries(category, items, posted[category])
        log(f"Found {len(new_entries)} new entries for '{category}'", "INFO")

        for item in new_entries:
            if total_posted >= MAX_POSTS_PER_RUN:
                break

            slug = item.get("slug") or item.get("name", "")
            title = item.get("title") or item.get("name", slug)

            log(f"Posting [{category}]: {title[:60]}…", "POST")
            msg = format_message(category, item)

            ok = send_whatsapp_message(msg, dry_run=dry_run)

            if ok:
                posted[category].append(slug)
                total_posted += 1
                log(f"Posted successfully. Total this run: {total_posted}", "OK")
                if total_posted < MAX_POSTS_PER_RUN:
                    time.sleep(POST_DELAY_SECONDS)
            else:
                log(f"Failed to post: {title[:40]}", "ERROR")

    # Save updated tracker
    if total_posted > 0 or not dry_run:
        save_posted_ids(posted)

    log("=" * 50, "INFO")
    log(f"✅ Bot finished. Total posted this run: {total_posted}", "OK")
    log("=" * 50, "INFO")

    return total_posted

# ─── CLI Entry Point ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Sarkari Sahayak WhatsApp Channel Auto-Poster"
    )
    parser.add_argument(
        "--test", action="store_true",
        help="Send a test message to verify setup"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Show what would be posted without actually sending"
    )
    parser.add_argument(
        "--category",
        choices=list(CATEGORY_CONFIG.keys()),
        default=None,
        help="Post only this category (default: all)"
    )
    parser.add_argument(
        "--max-posts", type=int, default=MAX_POSTS_PER_RUN,
        help=f"Max posts per run (default: {MAX_POSTS_PER_RUN})"
    )

    args = parser.parse_args()
    MAX_POSTS_PER_RUN = args.max_posts

    categories = [args.category] if args.category else None

    run_bot(
        categories=categories,
        dry_run=args.dry_run,
        test=args.test,
    )
