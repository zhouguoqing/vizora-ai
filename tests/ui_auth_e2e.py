"""Actual account UI + SMTP acceptance, only against an isolated test environment.

UI_BASE_URL=http://127.0.0.1:5187 SMTP_CAPTURE_URL=http://127.0.0.1:55253/messages \
UI_ARTIFACT_DIR=/absolute/path python3 tests/ui_auth_e2e.py
"""
import json
import os
import re
import secrets
import time
import urllib.request
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from playwright.sync_api import expect, sync_playwright

BASE = os.environ.get("UI_BASE_URL", "http://127.0.0.1:5187")
CAPTURE = os.environ.get("SMTP_CAPTURE_URL", "http://127.0.0.1:55253/messages")
OUT = Path(os.environ.get("UI_ARTIFACT_DIR", "/tmp/vizora-auth-e2e"))
OUT.mkdir(parents=True, exist_ok=True)
passed = []
errors = []
email = f"ui-auth-{secrets.token_hex(5)}@example.test"
password = secrets.token_urlsafe(24)
new_password = secrets.token_urlsafe(24)


def record(name):
    passed.append(name)
    print("PASS", name, flush=True)


def captured_links(route):
    with urllib.request.urlopen(CAPTURE, timeout=5) as response:
        messages = json.load(response)
    links = []
    for message in messages:
        if email not in str(message["to"]):
            continue
        for url in re.findall(r"https?://[^\s<>]+", message["text"]):
            parts = urlsplit(url)
            if parts.path == route and parse_qs(parts.query).get("token"):
                links.append(parts.path + "?" + parts.query)
    return links


def wait_link(route, previous=None):
    for _ in range(30):
        links = captured_links(route)
        if links and links[-1] != previous:
            return links[-1]
        time.sleep(0.2)
    raise RuntimeError(f"No new actual SMTP message for {route}; token content not printed")


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 1000}, reduced_motion="reduce")
        page = context.new_page()
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(BASE + "/register", wait_until="networkidle")
        registration = page.locator('section[aria-label="注册表单"]')
        registration.get_by_label("姓名 / 显示名称", exact=True).fill("真实邮箱 UI 验收")
        registration.get_by_label("电子邮箱", exact=True).fill(email)
        registration.get_by_label("设置密码", exact=True).fill(password)
        registration.get_by_role("checkbox").check()
        registration.get_by_role("button", name="免费开始", exact=True).click()
        expect(page).to_have_url(re.compile(r"/resend-verification\?"))
        expect(page.get_by_role("status")).to_contain_text("验证邮件已发送")
        first_link = wait_link("/verify-email")
        record("registration form -> actual API -> actual SMTP verification message")

        page.get_by_role("button", name="发送验证邮件", exact=True).click()
        expect(page.get_by_role("status")).to_be_visible()
        second_link = wait_link("/verify-email", first_link)
        assert second_link != first_link
        record("resend form sends a fresh one-time verification link")

        page.goto(BASE + second_link, wait_until="networkidle")
        page.get_by_role("button", name="确认验证邮箱", exact=True).click()
        expect(page).to_have_url(re.compile(r"/verify-email\?verified=1"))
        expect(page.get_by_role("status")).to_contain_text("验证成功")
        assert "token=" not in page.url
        record("email verification form consumes actual link and removes URL token")

        page.get_by_role("link", name="返回登录").click()
        login = page.locator('section[aria-label="登录表单"]')
        login.get_by_label("电子邮箱", exact=True).fill(email)
        login.get_by_label("密码", exact=True).fill(password)
        login.get_by_role("button", name="显示密码").click()
        expect(login.get_by_label("密码", exact=True)).to_have_attribute("type", "text")
        login.get_by_role("button", name="隐藏密码").click()
        login.get_by_role("button", name="登录", exact=True).click()
        expect(page).to_have_url(BASE + "/workspace")
        assert page.evaluate("localStorage.getItem('vizora_token')") is None
        assert page.evaluate("Boolean(sessionStorage.getItem('vizora_token'))")
        record("verified login works, password visibility toggles, remember-off uses session storage")

        recovery_context = browser.new_context(viewport={"width": 390, "height": 844}, reduced_motion="reduce")
        recovery = recovery_context.new_page()
        recovery.on("pageerror", lambda error: errors.append(str(error)))
        recovery.goto(BASE + "/forgot-password", wait_until="networkidle")
        recovery.get_by_label("电子邮箱", exact=True).fill(email)
        recovery.get_by_role("button", name="发送重置邮件", exact=True).click()
        expect(recovery.get_by_role("status")).to_be_visible()
        reset_link = wait_link("/reset-password")
        record("mobile forgot-password form delivers actual reset email")

        recovery.goto(BASE + reset_link, wait_until="networkidle")
        recovery.get_by_label("新密码", exact=True).fill(new_password)
        recovery.get_by_label("确认新密码", exact=True).fill(new_password + "-mismatch")
        recovery.get_by_role("button", name="确认重置密码", exact=True).click()
        expect(recovery.get_by_role("alert")).to_contain_text("不一致")
        recovery.get_by_label("确认新密码", exact=True).fill(new_password)
        recovery.get_by_role("button", name="确认重置密码", exact=True).click()
        expect(recovery).to_have_url(BASE + "/reset-password?completed=1")
        expect(recovery.get_by_role("status")).to_contain_text("密码已重置")
        assert "token=" not in recovery.url
        record("mobile reset rejects mismatch then commits actual password change")

        page.reload(wait_until="networkidle")
        expect(page).to_have_url(BASE + "/login?redirect=/workspace")
        record("password reset invalidates the earlier real browser session")

        recovery.get_by_role("link", name="返回登录").click()
        mobile_login = recovery.locator('section[aria-label="登录表单"]')
        mobile_login.get_by_label("电子邮箱", exact=True).fill(email)
        mobile_login.get_by_label("密码", exact=True).fill(new_password)
        mobile_login.get_by_role("checkbox").check()
        mobile_login.get_by_role("button", name="登录", exact=True).click()
        expect(recovery).to_have_url(BASE + "/workspace")
        assert recovery.evaluate("Boolean(localStorage.getItem('vizora_token'))")
        assert recovery.evaluate("sessionStorage.getItem('vizora_token')") is None
        recovery.screenshot(path=str(OUT / "mobile-recovered-account.png"), full_page=True)
        record("mobile login accepts new password and explicit remember-login persistence")

        recovery.get_by_role("button", name="退出全部登录会话").click()
        expect(recovery).to_have_url(BASE + "/")
        assert recovery.evaluate("localStorage.getItem('vizora_token')") is None
        assert not errors, errors
        record("logout revokes actual session and clears persisted credential")
        context.close()
        recovery_context.close()
        browser.close()


try:
    run()
finally:
    (OUT / "auth-results.json").write_text(json.dumps({"passed": passed, "browser_errors": errors}, ensure_ascii=False, indent=2))
    print(f"Evidence: {OUT}", flush=True)
