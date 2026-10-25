"""Real API/UI membership guards with isolated database fixtures, never merchant acceptance.

Requires an empty verified Free UI_TEST_EMAIL / UI_TEST_PASSWORD account,
TEST_DB_CONNECTION for its dedicated vizora_test* DB, and unconfigured gateways.
"""
import json
import os
import subprocess
import uuid
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import expect, sync_playwright

BASE = os.environ.get("UI_BASE_URL", "http://127.0.0.1:5188")
if urlsplit(BASE).hostname not in ("127.0.0.1", "localhost"):
    raise RuntimeError("Only isolated loopback services are allowed")
if not os.environ.get("TEST_DB_CONNECTION"):
    raise RuntimeError("TEST_DB_CONNECTION must identify the dedicated test database")
OUT = Path(os.environ.get("UI_ARTIFACT_DIR", "/tmp/vizora-membership-e2e"))
OUT.mkdir(parents=True, exist_ok=True)
passed = []
errors = []


def request(path, body=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    req = urllib.request.Request(BASE + "/api" + path, headers=headers,
                                 data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        return error.code, json.load(error)


def sql(text):
    subprocess.run(["dotnet", "run", "--project", "tests/api-integration/Api.Integration.csproj",
                    "--no-restore", "--", "sql"], input=text, text=True, check=True)


def record(name):
    passed.append(name)
    print("PASS", name, flush=True)


def run():
    email, password = os.environ["UI_TEST_EMAIL"], os.environ["UI_TEST_PASSWORD"]
    status, login = request("/auth/login", {"email": email, "password": password})
    assert status == 200
    token = login["token"]
    status, account = request("/me", token=token)
    assert status == 200 and account["membership"] is None, "Requires a dedicated Free account without membership"
    uid, order = str(uuid.UUID(account["id"])), str(uuid.uuid4())
    seeded = False
    try:
        sql(f"""BEGIN;
            INSERT INTO memberships(user_id,plan_code,valid_until)
            VALUES('{uid}','creator-year',now()+interval '365 days');
            INSERT INTO orders(id,order_no,user_id,plan_code,amount_fen,provider,duration_days)
            VALUES('{order}','MEMBER{order.replace('-', '')}','{uid}','fde-month',69900,'wechat',30);
            COMMIT;""")
        seeded = True
        for provider in ("wechat", "alipay"):
            status, result = request("/orders", {"planCode": "fde-month", "provider": provider}, token)
            assert status == 409 and result["code"] == "membership_tier_conflict"
            record(f"{provider}: server rejects cross-tier checkout before contacting gateway")
        for plan in ("creator-month", "creator-year"):
            status, result = request("/orders", {"planCode": plan, "provider": "wechat"}, token)
            assert status == 503 and result["code"] == "payment_unavailable"
            record(f"{plan}: same-tier renewal passes membership guard, reports actual unavailable gateway")
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            for width in (1440, 390):
                context = browser.new_context(viewport={"width": width, "height": 1000}, reduced_motion="reduce")
                page = context.new_page()
                page.on("pageerror", lambda error: errors.append(str(error)))
                page.goto(BASE + "/login", wait_until="networkidle")
                form = page.locator('section[aria-label="登录表单"]')
                form.get_by_label("电子邮箱", exact=True).fill(email)
                form.get_by_label("密码", exact=True).fill(password)
                form.get_by_role("button", name="登录", exact=True).click()
                expect(page).to_have_url(BASE + "/workspace")
                page.goto(BASE + "/billing?plan=fde-month", wait_until="networkidle")
                submit = page.get_by_role("button", name="创建订单并前往支付", exact=True)
                expect(submit).to_be_disabled()
                expect(page.get_by_role("alert")).to_contain_text("仅支持同档续期")
                page.get_by_label("选择套餐", exact=True).select_option("creator-year")
                expect(submit).to_be_enabled()
                record(f"{width}px: cross-tier purchase disabled, same-tier renewal enabled")
                page.locator(".order-row").filter(has_text="MEMBER" + order.replace("-", "")).click()
                dialog = page.get_by_role("dialog")
                expect(dialog.get_by_role("button", name="继续支付", exact=True)).to_be_disabled()
                expect(dialog.get_by_role("alert")).to_contain_text("不能继续支付异档订单")
                page.screenshot(path=str(OUT / f"membership-guard-{width}.png"), full_page=True)
                record(f"{width}px: existing cross-tier pending order cannot resume payment")
                context.close()
            browser.close()
        assert not errors, errors
        record("zero JavaScript exceptions in membership guard flows")
    finally:
        if seeded:
            sql(f"BEGIN; DELETE FROM orders WHERE id='{order}'; DELETE FROM memberships WHERE user_id='{uid}'; COMMIT;")
    (OUT / "membership-results.json").write_text(json.dumps({"passed": passed, "errors": errors}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    run()
