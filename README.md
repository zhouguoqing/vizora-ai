# Vizora AI V4.2

Vue 3 + TypeScript / ASP.NET Core 10 / PostgreSQL 的可视化应用门户。

依据 [概要设计](docs/概要设计.md) 和 [UI 原型](docs/UI/) 增量开发，确定的产品边界、计费口径和设计约束保存在 [项目记忆](AGENTS.md)。

> 工程可构建不等于完成正式商业验收。真实支付、外部 Designer、运营主体与法律文本必须完成 [上线门禁](RELEASE_GATE.md)，不得以演示成功或 Mock 代替。

## 目录与能力

- [web](web/)：响应式官网、登录注册与账号恢复、项目工作台、会员订单；真实 REST API，不设业务数据 Mock 回退。
- [api](api/)：.NET 10 API，账号验证、项目隔离、订单支付、退款接口、短效 Designer 票据、咨询线索。
- [db](db/)：PostgreSQL 表结构与套餐升级。
- [deploy](deploy/)：仅 PostgreSQL / Redis 容器配置；API / Web 本地运行，不使用 Nginx。
- [tests](tests/)：API 与浏览器验证、历史静态契约检查。

公开页面：`/`、`/features`、`/solutions`、`/templates`、`/pricing`、`/resources`、`/contact`、`/terms`、`/privacy`。

第二版首页预览：`/home-v2`，以浅薄荷绿视觉聚焦 AI 大屏设计与开发；与原版深蓝首页 `/` 并行，不改变其他页面或套餐规则。示例按钮切换经营、设备监控与项目交付看板，并带入需求；“开始设计”将需求保存后引导至注册或项目工作台，不代表已调用 AI 生成。试点咨询通过现有联系页面提交；预览看板、数据接入示意与产品规划均明确标识能力边界。

账号页面：`/login`、`/register`、`/verify-email`、`/resend-verification`、`/forgot-password`、`/reset-password`。

业务页面：`/workspace`、`/billing`。匿名访问保留原目标并跳转登录。会话可按用户选择仅保留在当前浏览器会话，或记住登录；退出调用服务端撤销会话。

### UI 及素材

- 深蓝星空、蓝青渐变、细边框、响应式卡片与轻量动效；尊重系统“减少动态效果”设置。
- [Logo](web/public/brand/logo.png) 直接提取自用户提供的登录原型，不使用字母 V 或其他品牌替代。
- [产品插画](web/public/brand/product-preview.webp) 是原型局部图，明确标为设计参考，不冒充实时业务数据。
- 模板页是需求场景灵感，使用后将描述带入真实项目；不是已部署、已连接数据的应用。
- 所有未经证实的客户背书和经营效果指标均不作为真实营销事实发布。

## 已确认计费

| 方案 | 月付（30 天） | 年付（365 天） | 项目配额 |
|---|---:|---:|---:|
| Free | 免费 | 免费 | 3 |
| Creator | ¥99 | ¥950 | 10 |
| FDE | ¥699 | ¥6,710 | 不限 |
| Enterprise | 企业咨询 | 企业咨询 | 合同约定 |

固定期限单次购买，不自动续费。前端从 API 取得价格，订单金额以服务端数据库为准；历史订单不改价。席位、AI 额度、数据连接、发票、组织协作和运行发布不冒充已交付套餐权益。

## 本地开发

推荐使用下方跨平台入口：需要 Node.js 22.12+、.NET SDK 10、Docker Engine / Docker Desktop 和 Compose v2。
PostgreSQL 17 与 Redis 7.4 运行在容器中，.NET API 和 Vue/Vite 在本机运行。

浏览器 → `http://localhost:5173`（Vite），`/api` → `http://127.0.0.1:8080`（本地 .NET）→ 容器 PostgreSQL。
Redis 本轮仅部署、认证、持久化和健康检查，后端尚未消费 Redis，不声明已实现分布式缓存或会话。
未配置外部服务会返回明确错误，不会自动切换到假数据。微信 Native 需要手机扫描另一设备上的二维码；同机微信 H5 / JSAPI 不在本轮范围。

### 跨平台启动入口

Windows 使用 `.\start.cmd`（CMD / PowerShell 均可）或 `.\start.ps1`；
Linux、macOS 使用 `bash ./start.sh`。入口从脚本位置定位工程，支持包含空格的路径，不依赖当前工作目录。
以下命令以 Linux/macOS 为例；Windows 将 `bash ./start.sh` 换成 `.\start.cmd`，其余参数相同。
所有模式均需 Node.js 22.12+。仅启动基础设施的 Docker 模式不要求本机安装 .NET、PostgreSQL 或 Redis。

**一键混合启动（默认模式）：**

1. 将 [环境示例](deploy/.env.example) 复制为 `deploy/.env`，填写不同的随机数据库口令、Redis 口令及至少 40 字符的 JWT 签名密钥。已有文件只补充缺失项，**不要重置已有 PostgreSQL 数据卷的口令**。
2. 初次安装前端依赖：`npm ci --prefix web`。脚本不会自动安装系统软件或 npm 依赖。
3. 启动 Docker Desktop（Windows/macOS，Linux 容器模式）或 Linux Docker Engine。
4. 执行 `bash ./start.sh check dev` 检查配置、Docker、.NET 10、依赖及 API/Web 端口。
5. 执行 `bash ./start.sh` 或 `bash ./start.sh dev`：先启动并等待 PG/Redis 健康，再构建与启动本地 API，等待真实数据库 `/api/health`，最后启动 Vite。就绪后访问 `http://localhost:5173`。

API 绑定 `127.0.0.1:8080`，Web 绑定 `127.0.0.1:5173`，端口被占用会明确失败，不会自动杀进程或切换端口。
PostgreSQL 默认仅发布 `127.0.0.1:5432`，Redis 默认仅发布 `127.0.0.1:6379`；可在 `deploy/.env` 用 `POSTGRES_PORT` / `REDIS_PORT` 调整宿主机端口。
PG 数据库/用户名均为 `vizora`。脚本从 `deploy/.env` 的数据库口令与端口构造本地连接，不需要手工复制连接串；不允许用 `ConnectionStrings__Main` 悄悄改连其他数据库。
API 配置优先级为进程环境变量 > 可选的 `.env.dev` > `deploy/.env`；PG/Redis 的口令、端口只从进程环境与 `deploy/.env` 读取。
需要覆盖 SMTP 等本地配置时，可复制 [.env.dev.example](.env.dev.example) 为被忽略的 `.env.dev`。163 邮箱使用 465 隐式 TLS；新授权码只在本机填写 `Mail__Password`，不要提交或粘贴到聊天。当前已在聊天中暴露的授权码应先撤销并轮换。脚本固定 Development、loopback 地址及本地回跳地址，不读取示例公网地址。
前端支持热更新；修改后端代码后停止并重新启动。缺少 SMTP、商户或 Designer 配置不会伪装为功能可用。

**仅启动 PG / Redis：**

执行 `bash ./start.sh docker`；仅启动带持久卷和健康检查的 PostgreSQL、Redis，不构建应用镜像，不启动 API/Web，不提供 8088 网站端口。
Redis 启用密码认证与 AOF。`check docker` 只校验基础设施配置，无需 JWT 或本地 .NET。

沿用同一 Compose 项目与 `pgdata` 卷：新卷首次执行 [schema.sql](db/schema.sql)，已有卷**不会自动升级**，须先备份并按 [API 运维说明](api/CONTRACT.md) 手动迁移。
如果曾用旧版 Compose 启动 API/Web 容器，先查看 `docker compose -f deploy/compose.yml --env-file deploy/.env ps -a`，确认归属后用 `docker stop <旧容器ID>` 停止旧 API/Web；脚本不会擅自删除孤立容器或数据卷。
该入口用于本机开发，不代替生产 HTTPS、正式法律审核或支付/邮件/Designer 联调。启动失败返回非零退出码；已创建的基础设施容器保留，方便查看日志。

| 操作 | 本地应用（默认启动含基础设施） | 仅 PG / Redis 容器 |
|---|---|---|
| 检查环境 | `bash ./start.sh check dev` | `bash ./start.sh check docker` |
| 启动 | `bash ./start.sh dev` | `bash ./start.sh docker` |
| 查看状态 | `bash ./start.sh status dev` | `bash ./start.sh status docker` |
| 最近日志 | `bash ./start.sh logs dev` | `bash ./start.sh logs docker` |
| 停止 | `bash ./start.sh stop dev` | `bash ./start.sh stop docker` |
| 帮助 | `bash ./start.sh help` | 同左 |

开发模式前台运行，Ctrl+C 或另一终端的 `stop dev` 只关闭本调度器启动的本地进程；任一本地服务意外退出会关闭另一个并返回失败。
PG/Redis 保持后台运行，只有显式 `stop docker` 才停止这两个服务，不删除容器或数据卷；不要在本地 API 使用数据库时停止容器。
开发日志（infra/build/api/web）和控制状态保存在已忽略的 `.runtime/`，环境文件及日志均可能含敏感信息，不要提交或公开分享。
开发控制接口仅监听随机 loopback 端口并校验随机令牌。Windows 上请使用个人受限目录的 NTFS 权限保护配置、状态和日志。
异常断电后若遗留 `.runtime/dev.lock`，先核实其中 PID 及相关服务均已停止，再删除该锁文件并重试；脚本不会按陈旧 PID 杀进程。
`status dev` 无响应时返回 1；Docker 状态沿用 Compose 的 `ps -a` 输出和退出码，不作为完整健康验收。

脚本回归：`node --test tests/startup.test.mjs`。跨平台入口共享同一 Node 实现；未在 Windows/Linux 实机运行前，不应把本机验证等同于三平台验收。
当前验证结果以本次交付说明为准，不将脚本回归或 Compose 配置校验当作真实容器及业务验收。

## 测试

```bash
# 类型检查及生产静态包
npm run build --prefix web

# API 客户端、会话竞态、支付页异步状态回归
npm test --prefix web

# 后端 Release 编译
dotnet build api/Vizora.Api.csproj -c Release

# 后端 SMTP 配置单元测试（不连接真实邮件服务器）
dotnet test tests/api-unit/Api.UnitTests.csproj
```

SMTP 单元测试验证 TLS 模式选择，不连接 163 或使用真实凭据；后端独立 PostgreSQL、loopback SMTP 捕获和 schema 初始化的完整复现步骤见 [API 契约与测试说明](api/CONTRACT.md)。准备好隔离服务后执行 `node tests/api-integration.mjs`；该集成套件仅验证应用邮件流程，不证明真实邮箱投递或商户成功付款。不要指向生产服务或数据库。

真实浏览器逐页验收：

```bash
python3 -m pip install -r tests/requirements-ui.txt
python3 -m playwright install chromium

# Web/API 必须运行；账号必须在独立测试库中真实注册并验证过邮箱。
# 用环境变量提供测试账号，不能使用生产账号或提交凭据。
UI_BASE_URL=http://127.0.0.1:5187 \
UI_TEST_EMAIL=your-isolated-test-account \
UI_TEST_PASSWORD=your-isolated-test-password \
UI_ARTIFACT_DIR=/absolute/path/to/evidence \
python3 tests/ui_e2e.py
```

[浏览器用例](tests/ui_e2e.py) 覆盖公开页面的桌面/平板/移动布局、导航、套餐月年价格、模板搜索与详情、场景切换、FAQ、无效验证链接、真实咨询提交、登录、项目保存/刷新/删除、工作台/账单与退出。没有网络拦截或伪造 API 成功；缺少测试账号会失败，而非静默跳过登录后用例。

独立测试环境还提供：

- [账号 UI 验收](tests/ui_auth_e2e.py)：通过真实注册接口和 SMTP 协议捕获器取得邮件，实际验证重发、邮箱验证、忘记密码、密码重置、旧会话失效和移动端登录。使用 `SMTP_CAPTURE_URL` 指定隔离捕获服务，不接触生产邮箱。
- [业务边界 UI 验收](tests/ui_business_edges.py)：使用独立、空白的 Free 测试账号，验证三项目配额、删除释放、未配置 Designer 和双支付渠道的明确失败。仅用于外部服务故意未配置的本地测试环境。
- [会员策略验收](tests/ui_membership_e2e.py)：9 项真实 API / PC与手机检查，验证异档购买保护、同档月/年续期和旧异档订单禁续付。需要同一隔离数据库的 `TEST_DB_CONNECTION`，临时会员/订单夹具由测试自行清理。13 项数据库领域回归的运行命令见 [API 契约](api/CONTRACT.md)。

2026-10-21 本地结果：前端 35 项单元回归、后端 27 项真实 API 集成断言、13 项真实数据库领域回归通过；生产构建完成 81 项逐页/业务流程和 9 项会员策略 API/UI 检查，共 90 项。前后端 Release / 生产构建通过。官方 NuGet 源和前端生产依赖核查未发现已知漏洞。真实商户、正式邮件投递和生产发布门禁仍须另验。

单元测试中的受控依赖仅用于验证错误和并发边界，不作为生产功能或真实商户验收。历史 `tests/check*.py` 是静态检查，不能替代构建、数据库或浏览器验证。

## 生产部署

当前 [Compose 配置](deploy/compose.yml) **仅管理 PG / Redis**，不再部署 API、Web 或 Nginx；跨平台启动入口使用本地 Development API 与 Vite，**不是生产发布方案**。正式上线仍需完成 [上线门禁](RELEASE_GATE.md)：

1. 配置真实运营主体、备案与专业审核后的协议、隐私、退款政策和联系渠道。
2. 在受控环境配置强密钥、数据库、SMTP、微信/支付宝商户证书、公网 HTTPS 回调及 Designer 服务。
3. 先在预发布执行数据库升级与恢复演练，再使用受控宿主机进程管理部署 Release API 与 Web 生产构建；另行配置静态资源服务、SPA 回退、HTTPS 和 API 转发，不强制依赖 Nginx。PG/Redis 不得暴露公网。
4. 验证小额真实交易、重复通知、退款最终态、叠加权益、Designer 票据兑换和可观测性，再开放付费流量。

在与 API 相同的受控运行时及配置注入环境中，先运行 `node scripts/production-readiness.mjs`，并确保 `ASPNETCORE_ENVIRONMENT=Production`；若设置 `DOTNET_ENVIRONMENT`，其值也必须为 `Production`。该检查器只读取进程环境变量，只输出缺项/格式异常的配置键名，不读取 `.env` 文件、不输出配置值、不发起网络请求，也不创建订单。配置键使用 ASP.NET 环境变量映射（例如 `Payments:Wechat:AppId` 对应 `Payments__Wechat__AppId`）。支付通知地址还必须指向公开 API 同一 origin 和实际实现的渠道回调路由。若 API 通过额外配置提供程序取值，检查器必须接入同一配置来源，否则应失败关闭；不可用开发机的配置结果代替生产运行时结果。检查通过仍不等于 HTTPS 回调可达、证书商户身份有效、法律材料已审核或真实支付已验收；这些须分别由运营人员验证。

```bash
# 仅启动基础设施，不是完整网站部署。
docker compose -f deploy/compose.yml --env-file deploy/.env up -d --wait postgres redis
```

生产 API 的密钥需通过受控服务端配置注入，不会因容器读取 `deploy/.env` 自动传入手工启动的 API。不得将 Vite 开发服务器、本地 SMTP 捕获器、测试账号、商户替身或调试接口带入生产。未通过门禁的外部功能不能声明为已上线。
