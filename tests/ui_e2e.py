"""Real-browser checks. Requires running Web/API and a verified isolated test account.

UI_BASE_URL=http://127.0.0.1:5187 UI_TEST_EMAIL=... UI_TEST_PASSWORD=... \
UI_ARTIFACT_DIR=/absolute/path python3 tests/ui_e2e.py

No request interception, fabricated API responses, or payment success simulation.
"""
import json
import os
import time
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

BASE = os.environ.get("UI_BASE_URL", "http://127.0.0.1:5187")
ARTIFACTS = Path(os.environ.get("UI_ARTIFACT_DIR", "/tmp/vizora-ui-e2e"))
ARTIFACTS.mkdir(parents=True, exist_ok=True)
PUBLIC = [
    "/", "/features", "/solutions", "/templates", "/pricing", "/resources",
    "/contact", "/login", "/register", "/verify-email", "/resend-verification",
    "/forgot-password", "/reset-password", "/terms", "/privacy", "/missing-page",
]
results = []
errors = []


def record(name):
    results.append(name)
    print("PASS", name, flush=True)


def check_layout(page, route, width):
    page.goto(BASE + route, wait_until="networkidle")
    expect(page.locator("h1").first).to_be_visible()
    heading = page.locator("h1").first.bounding_box()
    assert heading and heading["x"] >= 15, f"Missing safe heading gutter: {route} at {width}px"
    expect(page.locator("main")).to_be_visible()
    assert page.title().endswith("· Vizora AI"), page.title()
    overflow = page.evaluate("document.documentElement.scrollWidth > innerWidth + 1")
    assert not overflow, f"Horizontal page overflow: {route} at {width}px"
    for image in page.locator("img").all():
        assert image.evaluate("(img) => img.complete && img.naturalWidth > 0"), f"Broken image on {route}"
    assert not page.locator("main").inner_text().strip() == ""
    record(f"route {route} viewport {width}px")


def run():
    email = os.environ.get("UI_TEST_EMAIL")
    password = os.environ.get("UI_TEST_PASSWORD")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 1000}, reduced_motion="reduce")
        page = context.new_page()
        page.on("pageerror", lambda error: errors.append(str(error)))
        for width in (1440, 768, 390):
            page.set_viewport_size({"width": width, "height": 1000 if width > 640 else 844})
            for route in PUBLIC:
                check_layout(page, route, width)
            for route in ("/", "/pricing", "/login"):
                page.goto(BASE + route, wait_until="networkidle")
                page.screenshot(path=str(ARTIFACTS / f"{route.strip('/') or 'home'}-{width}.png"), full_page=True)
        page.set_viewport_size({"width": 390, "height": 844})
        page.goto(BASE + "/", wait_until="networkidle")
        page.get_by_role("button", name="打开导航菜单").click()
        expect(page.get_by_role("navigation", name="主导航")).to_be_visible()
        page.get_by_role("navigation", name="主导航").get_by_role("link", name="价格方案").click()
        expect(page).to_have_url(BASE + "/pricing")
        expect(page.get_by_role("navigation", name="主导航")).not_to_be_visible()
        record("mobile navigation opens, navigates, closes")

        page.set_viewport_size({"width": 1440, "height": 1000})
        page.goto(BASE + "/pricing", wait_until="networkidle")
        expect(page.locator(".plan").filter(has=page.get_by_role("heading", name="Creator", exact=True))).to_contain_text("¥99")
        page.get_by_role("button", name="年付").click()
        expect(page.locator(".plan").filter(has=page.get_by_role("heading", name="Creator", exact=True))).to_contain_text("¥950")
        expect(page.locator(".plan").filter(has=page.get_by_role("heading", name="FDE", exact=True))).to_contain_text("¥6,710")
        record("real API pricing monthly/yearly exact approved amounts")

        page.goto(BASE + "/templates", wait_until="networkidle")
        page.get_by_label("搜索模板").fill("不存在的场景")
        expect(page.get_by_text("暂无匹配的场景")).to_be_visible()
        page.get_by_role("button", name="清空筛选").click()
        page.get_by_role("button", name="地图应用", exact=True).click()
        expect(page.locator(".gallery-card")).to_have_count(1)
        page.get_by_role("button", name="查看详情").click()
        expect(page.get_by_role("dialog", name="地图调度应用")).to_be_visible()
        page.keyboard.press("Escape")
        expect(page.get_by_role("dialog")).not_to_be_visible()
        record("template search, empty state, category, accessible detail dialog")

        page.goto(BASE + "/solutions", wait_until="networkidle")
        page.get_by_role("button", name="AI原生组织", exact=True).click()
        expect(page.get_by_role("button", name="AI原生组织", exact=True)).to_have_attribute("aria-pressed", "true")
        page.get_by_role("button", name="能源运营中心", exact=True).click()
        expect(page.get_by_role("heading", name="精选应用场景：能源运营中心")).to_be_visible()
        record("audience tabs and featured scene navigation")

        page.goto(BASE + "/", wait_until="networkidle")
        first_faq = page.locator("details").first
        first_faq.locator("summary").click()
        expect(first_faq).to_have_attribute("open", "")
        first_faq.locator("summary").click()
        expect(first_faq).not_to_have_attribute("open", "")
        record("FAQ expand and collapse")

        page.goto(BASE + "/workspace", wait_until="networkidle")
        expect(page).to_have_url(BASE + "/login?redirect=/workspace")
        record("anonymous workspace guard preserves intended redirect")

        page.goto(BASE + "/verify-email?token=invalid", wait_until="networkidle")
        page.get_by_role("button", name="确认验证邮箱", exact=True).click()
        expect(page.get_by_role("alert")).to_be_visible()
        record("invalid email token produces real API error")

        page.goto(BASE + "/contact", wait_until="networkidle")
        page.get_by_label("姓名", exact=True).fill("UI 验收")
        page.get_by_label("企业名称", exact=True).fill("Vizora 隔离测试")
        page.get_by_label("工作邮箱", exact=True).fill(f"ui-{int(time.time())}@example.test")
        page.get_by_label("希望了解的内容").fill("真实 API 持久化咨询验证，不包含敏感数据。")
        page.get_by_role("checkbox").check()
        with page.expect_response(lambda response: response.url.endswith("/api/leads") and response.request.method == "POST") as captured:
            page.get_by_role("button", name="提交企业咨询").click()
        assert captured.value.ok, captured.value.status
        expect(page.get_by_role("status").filter(has_text="咨询已提交")).to_be_visible()
        record("consultation POST persisted through real backend")

        if not email or not password:
            raise RuntimeError("UI_TEST_EMAIL / UI_TEST_PASSWORD are required; authenticated tests must not be silently skipped")
        page.goto(BASE + "/login?redirect=/workspace", wait_until="networkidle")
        form = page.get_by_role("region", name="登录表单") if page.get_by_role("region", name="登录表单").count() else page.locator('section[aria-label="登录表单"]')
        form.get_by_label("电子邮箱", exact=True).fill(email)
        form.get_by_label("密码", exact=True).fill(password)
        form.get_by_role("button", name="登录", exact=True).click()
        expect(page).to_have_url(BASE + "/workspace")
        expect(page.get_by_role("heading", name="我的工作台")).to_be_visible()
        record("verified account logs in using real API")

        project_title = f"浏览器验收-{int(time.time())}"
        page.get_by_role("button", name="新建项目", exact=True).click()
        dialog = page.get_by_role("dialog", name="创建应用项目")
        dialog.get_by_label("项目名称", exact=True).fill(project_title)
        dialog.get_by_label("你希望创建什么应用？").fill("真实数据库项目，验证保存、检索与删除。")
        dialog.get_by_role("button", name="创建项目", exact=True).click()
        expect(page.get_by_role("heading", name=project_title)).to_be_visible()
        page.reload(wait_until="networkidle")
        expect(page.get_by_role("heading", name=project_title)).to_be_visible()
        page.get_by_label("搜索我的项目").fill(project_title)
        expect(page.locator(".project")).to_have_count(1)
        record("project creation persists across browser reload and search")

        for width in (1440, 390):
            page.set_viewport_size({"width": width, "height": 1000 if width > 640 else 844})
            check_layout(page, "/workspace", width)
            page.screenshot(path=str(ARTIFACTS / f"workspace-{width}.png"), full_page=True)
            check_layout(page, "/billing", width)
            expect(page.get_by_role("heading", name="会员与订单")).to_be_visible()
            assert not page.get_by_role("alert").count(), "Billing failed to load actual account/plans/orders"
            page.screenshot(path=str(ARTIFACTS / f"billing-{width}.png"), full_page=True)
        record("workspace/billing real API state at desktop and mobile widths")

        page.set_viewport_size({"width": 1440, "height": 1000})
        page.goto(BASE + "/workspace", wait_until="networkidle")
        page.get_by_label("搜索我的项目").fill(project_title)
        page.get_by_role("button", name=f"删除项目 {project_title}").click()
        page.get_by_role("dialog", name="确认删除项目").get_by_role("button", name="确认删除", exact=True).click()
        expect(page.get_by_role("heading", name=project_title)).not_to_be_visible()
        record("project delete uses confirmation and real API")

        page.get_by_role("button", name="退出全部登录会话").click()
        expect(page).to_have_url(BASE + "/")
        page.goto(BASE + "/billing", wait_until="networkidle")
        expect(page).to_have_url(BASE + "/login?redirect=/billing")
        record("logout invalidates server session and guards billing")
        assert not errors, errors
        record("zero browser JavaScript exceptions")
        context.close()
        browser.close()


try:
    run()
finally:
    (ARTIFACTS / "results.json").write_text(json.dumps({"passed": results, "browser_errors": errors}, ensure_ascii=False, indent=2))
    print(f"Evidence: {ARTIFACTS}", flush=True)
