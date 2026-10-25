"""Actual quota and unconfigured-service UI checks, against isolated local services.

Requires UI_TEST_EMAIL / UI_TEST_PASSWORD for a verified Free test account.
Payments and Designer must intentionally be unconfigured; never run on production.
"""
import json
import os
import time
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

BASE = os.environ.get("UI_BASE_URL", "http://127.0.0.1:5187")
OUT = Path(os.environ.get("UI_ARTIFACT_DIR", "/tmp/vizora-business-edges"))
OUT.mkdir(parents=True, exist_ok=True)
passed = []
errors = []


def record(name):
    passed.append(name)
    print("PASS", name, flush=True)


def run():
    email, password = os.environ["UI_TEST_EMAIL"], os.environ["UI_TEST_PASSWORD"]
    prefix = f"边界验收-{int(time.time())}-"
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 1000}, reduced_motion="reduce")
        page = context.new_page()
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(BASE + "/login", wait_until="networkidle")
        login = page.locator('section[aria-label="登录表单"]')
        login.get_by_label("电子邮箱", exact=True).fill(email)
        login.get_by_label("密码", exact=True).fill(password)
        login.get_by_role("button", name="登录", exact=True).click()
        expect(page).to_have_url(BASE + "/workspace")
        token = page.evaluate("sessionStorage.getItem('vizora_token')")
        headers = {"Authorization": "Bearer " + token}
        initial = page.request.get(BASE + "/api/dashboards", headers=headers)
        assert initial.ok and initial.json() == [], "Requires a dedicated empty Free account"
        try:
            for i in range(3):
                page.get_by_role("button", name="新建项目", exact=True).click()
                dialog = page.get_by_role("dialog", name="创建应用项目")
                dialog.get_by_label("项目名称", exact=True).fill(prefix + str(i))
                dialog.get_by_role("button", name="创建项目", exact=True).click()
                expect(page.get_by_role("heading", name=prefix + str(i))).to_be_visible()
            expect(page.get_by_role("button", name="新建项目", exact=True)).to_be_disabled()
            expect(page.get_by_text("已达到 3 个项目配额。", exact=False)).to_be_visible()
            record("Free quota is exactly three persisted projects and UI prevents fourth")

            rejected = page.request.post(BASE + "/api/dashboards", headers=headers, data={"title": prefix + "forbidden", "prompt": ""})
            assert rejected.status in (403, 409), rejected.status
            assert rejected.json().get("error"), "Quota rejection must include a real API error"
            record("server independently rejects fourth project, not just disabled UI")

            first = page.locator(".project").filter(has=page.get_by_role("heading", name=prefix + "0", exact=True))
            with page.expect_popup() as created_popup:
                first.get_by_role("button", name="进入 AI Designer", exact=True).click()
            popup = created_popup.value
            expect(page.get_by_role("alert")).to_be_visible()
            expect(page.get_by_role("alert")).to_contain_text("Designer")
            assert popup.is_closed(), "Unconfigured Designer must close the blank launch window"
            record("unconfigured Designer reports actual service error and closes blank popup")

            page.get_by_role("button", name="删除项目 " + prefix + "0", exact=True).click()
            page.get_by_role("dialog", name="确认删除项目").get_by_role("button", name="确认删除", exact=True).click()
            expect(page.get_by_role("button", name="新建项目", exact=True)).to_be_enabled()
            record("deleting project frees quota and re-enables creation")

            page.goto(BASE + "/billing", wait_until="networkidle")
            options = page.get_by_label("选择套餐", exact=True).locator("option")
            expect(options).to_have_count(4)
            assert all(option.get_attribute("value") != "free" for option in options.all())
            before = page.request.get(BASE + "/api/orders", headers=headers).json()
            for method in ("微信支付", "支付宝"):
                page.get_by_role("button", name=method, exact=True).click()
                with page.expect_response(lambda response: response.url.endswith("/api/orders") and response.request.method == "POST") as attempted:
                    page.get_by_role("button", name="创建订单并前往支付", exact=True).click()
                assert attempted.value.status == 503, attempted.value.status
                expect(page.get_by_role("alert")).to_be_visible()
                expect(page.get_by_role("button", name="创建订单并前往支付", exact=True)).to_be_enabled()
                assert page.locator(".qr-image").count() == 0
                assert not page.get_by_text("付款已由服务端确认", exact=False).count()
            after = page.request.get(BASE + "/api/orders", headers=headers).json()
            assert before == after, "Unconfigured gateways must not fabricate payable orders"
            assert len(context.pages) == 1, "Failed Alipay launch must not leak blank windows"
            record("both unconfigured gateways fail explicitly without fake QR, paid success, orders or window leaks")
            page.screenshot(path=str(OUT / "billing-unconfigured-gateway.png"), full_page=True)
            assert not errors, errors
            record("zero JavaScript exceptions in quota and failure paths")
        finally:
            actual = page.request.get(BASE + "/api/dashboards", headers=headers)
            if actual.ok:
                for project in actual.json():
                    if project["title"].startswith(prefix):
                        deleted = page.request.delete(BASE + "/api/dashboards/" + project["id"], headers=headers)
                        assert deleted.ok, "Failed cleanup of explicitly created test project"
            context.close()
            browser.close()


try:
    run()
finally:
    (OUT / "business-edge-results.json").write_text(json.dumps({"passed": passed, "browser_errors": errors}, ensure_ascii=False, indent=2))
    print(f"Evidence: {OUT}", flush=True)
