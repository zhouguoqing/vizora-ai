# Vizora AI V4.2

**聚焦 AI 大屏设计与开发，让想法成为看得见的业务全景。**

Vizora AI 面向 FDE（前线部署工程师）、软件服务商与企业数字化团队，提供从需求描述、账号注册、项目管理到外部 Designer 接入的应用门户，以及会员订单、支付渠道和企业咨询接口。

项目基于 **Vue 3 + TypeScript + ASP.NET Core 10 + PostgreSQL**，在现有工程上增量开发。第二版首页以 AI 数据可视化大屏为核心，覆盖经营驾驶舱、设备监控、项目交付等场景。

> **能力边界**：本仓库不是完整的大屏设计器或通用应用运行引擎。大屏生成、编辑、数据绑定和运行由外部 Designer 提供；界面中的示例数据、布局概念和规划能力均不代表已经交付。源码完成、本地验证通过、外部联调通过和生产验收通过是不同阶段。

[快速开始](#快速开始) · [功能与边界](#功能与边界) · [配置说明](#配置说明) · [测试与验证](#测试与验证) · [生产部署](#生产部署) · [MIT 许可证](#许可证)

## 目录

- [产品定位](#产品定位)
- [功能与边界](#功能与边界)
- [页面与入口](#页面与入口)
- [技术栈与架构](#技术栈与架构)
- [仓库结构](#仓库结构)
- [快速开始](#快速开始)
- [启动与运维命令](#启动与运维命令)
- [配置说明](#配置说明)
- [数据库与核心流程](#数据库与核心流程)
- [测试与验证](#测试与验证)
- [生产部署](#生产部署)
- [常见问题](#常见问题)
- [开发与贡献](#开发与贡献)
- [相关文档](#相关文档)
- [许可证](#许可证)

## 产品定位

Vizora AI 将业务目标转化为可继续设计的大屏项目，帮助团队梳理关键指标、数据来源、展示布局与交付边界。

适用方向包括：

- **经营驾驶舱**：围绕营收、利用率、区域表现等指标组织业务全景。
- **设备监控大屏**：展示设备状态、运行趋势与需要关注的异常。
- **项目交付看板**：整理里程碑、阶段进度与交付风险。
- **行业数据大屏**：以能源、园区、制造与调度等具体业务问题为起点。

上述场景是设计方向，不是已经接通数据的业务系统。真实数据、权限、性能与部署方式需要结合外部 Designer 和实施环境验证。

## 功能与边界

| 模块 | 当前范围 | 接入与验收说明 |
| --- | --- | --- |
| 商业官网 | 首页、产品能力、场景、模板灵感、资源、咨询及法律页面 | 案例与概念展示不作为真实客户背书 |
| 第二版首页 | 独立浅色首页、三类示例看板、团队切换与需求输入 | 与原首页并行；示例非实时 AI 生成 |
| 账号 | 邮箱注册、验证、登录、重发验证、密码恢复及会话撤销 | 注册及恢复需要实际 SMTP 配置 |
| 项目工作台 | 项目创建、搜索、持久保存、删除、所有权与配额校验 | 保存的是项目记录及需求，不是已生成的大屏 |
| Designer 入口 | 项目校验、短效一次性票据及兑换接口 | 真实 Designer 须独立接入和联调 |
| 会员与订单 | 服务端套餐、订单状态、固定期限权益及对账接口 | 本 README 不列出套餐金额，以实际服务端配置为准 |
| 支付渠道 | 微信 Native、支付宝电脑网站支付 | 需要真实商户配置、验签及交易验收 |
| 退款 | 管理接口、商户状态核对与权益撤销路径 | 叠加或历史权益需人工复核，不代表完整自动重算 |
| 企业咨询 | 联系表单、隐私同意及数据库持久化 | 不以打开邮件客户端冒充提交成功 |
| Redis | 容器部署、认证、健康检查及 AOF 持久化 | 尚未接入业务缓存或会话 |

组织成员、发票、应用版本、运行发布中心及完整运营后台属于后续规划，不在当前已交付闭环内。

## 页面与入口

| 类型 | 路由 |
| --- | --- |
| 原版深蓝首页 | `/` |
| 第二版浅色首页 | `/home-v2` |
| 产品与场景 | `/features`、`/solutions`、`/templates` |
| 资源与咨询 | `/resources`、`/contact` |
| 套餐展示 | `/pricing` |
| 法律页面 | `/terms`、`/privacy` |
| 注册与登录 | `/register`、`/login` |
| 邮箱验证 | `/verify-email`、`/resend-verification` |
| 账号恢复 | `/forgot-password`、`/reset-password` |
| 用户业务 | `/workspace`、`/billing` |

### 第二版首页

第二版采用浅薄荷背景、墨绿强调色与白色看板卡片，仅在 `/home-v2` 使用独立导航和页脚，不影响原版深蓝页面。

- 切换经营、设备监控和交付示例时，同步更新概念看板及需求描述。
- “开始设计”将需求保存到当前浏览器会话；匿名用户进入注册页，已登录用户进入工作台。
- 工作台继续负责服务端项目创建，首页操作不会直接调用 AI 生成。
- 试点入口进入现有咨询页面，数据接入与产品路线均明确标识能力边界。
- 移动端提供折叠菜单，支持键盘操作、Esc 关闭与焦点恢复。

视觉素材沿用现有 [Logo](web/public/brand/logo.png) 和 [产品插画](web/public/brand/product-preview.webp)。插画是设计参考，不是实时业务界面；不使用整张原型截图替代真实网页组件，也不虚构客户标识或经营指标背书。

## 技术栈与架构

| 层次 | 技术 |
| --- | --- |
| 前端 | Vue 3、TypeScript、Vue Router、Vite、Lucide 图标 |
| 后端 | ASP.NET Core 10 Minimal API、Npgsql、MailKit |
| 数据库 | PostgreSQL 17 |
| 基础设施 | Redis 7.4、Docker Compose v2 |
| 测试 | Vitest、xUnit、Node.js test runner、PostgreSQL 集成测试、Playwright 浏览器脚本 |

本地采用混合启动：**仅 PostgreSQL / Redis 在容器中，API 和 Web 在本机运行**。

```text
浏览器
  └─ http://localhost:5173（Vite）
       └─ /api 代理 → http://127.0.0.1:8080（ASP.NET Core）
                         ├─ PostgreSQL（容器，持久化业务数据）
                         ├─ SMTP（邮箱验证与账号恢复）
                         ├─ 外部 Designer（独立设计与运行服务）
                         └─ 微信 / 支付宝（商户支付及退款）

Redis（容器）已部署，尚未被业务代码消费。
```

仓库不包含 API / Web 的 Dockerfile 或 Nginx 部署配置。生产静态资源服务、HTTPS 和 API 转发需要另行部署。

## 仓库结构

```text
.
├── web/                    # Vue 官网、账号、工作台与账单界面
│   ├── src/pages/          # 页面及第二版首页
│   ├── src/components/     # Logo、预览、弹窗及通用状态组件
│   └── public/brand/       # 品牌与产品展示素材
├── api/                    # Minimal API、账号、项目、支付与退款逻辑
│   └── CONTRACT.md         # API 契约与隔离环境复现说明
├── db/schema.sql           # 幂等表结构及套餐迁移
├── deploy/                 # PG / Redis Compose 与环境示例
├── scripts/                # 跨平台启动器与生产就绪检查器
├── tests/                  # 单元、集成、浏览器及静态契约检查
├── docs/                   # 概要设计、UI 原型及其他设计资料
├── start.sh                # macOS / Linux 启动入口
├── start.cmd               # Windows CMD 启动入口
├── start.ps1               # Windows PowerShell 启动入口
├── .env.dev.example        # 可选本地 API 配置示例
├── RELEASE_GATE.md         # 正式上线验收门禁
└── LICENSE                 # MIT 许可证
```

## 快速开始

### 1. 安装前置环境

- **Node.js 22.12 或更高版本**，包含 npm。
- **.NET SDK 10**。
- **Docker Engine / Docker Desktop** 与 **Docker Compose v2**。
- Git，用于获取源码。

仅启动基础设施时无需本机安装 .NET、PostgreSQL 或 Redis，但启动入口仍要求 Node.js。可使用 `node --version`、`dotnet --list-sdks` 和 `docker compose version` 检查环境。

### 2. 获取项目

```bash
git clone https://github.com/zhouguoqing/vizora-ai-v4.2.git
cd vizora-ai-v4.2
```

### 3. 准备本地配置

macOS / Linux：

```bash
cp deploy/.env.example deploy/.env
# 按需配置 SMTP 或外部服务覆盖项
cp .env.dev.example .env.dev
```

PowerShell：

```powershell
Copy-Item deploy/.env.example deploy/.env
# 按需配置 SMTP 或外部服务覆盖项
Copy-Item .env.dev.example .env.dev
```

上述复制命令仅用于文件不存在的首次安装。已有本地配置应直接编辑并补充缺项，**不要覆盖已有口令或密钥**。

编辑 `deploy/.env`，至少设置：

- `POSTGRES_PASSWORD`：强随机数据库口令。
- `REDIS_PASSWORD`：独立随机口令，不与数据库共用。
- `Auth__SigningKey`：至少 40 字符，建议使用 64 字符以上随机密钥。

配置示例中的占位符不能用作实际凭据。环境文件已在忽略规则中，仍需限制本机访问权限，不得提交到 Git 或粘贴到公开日志、Issue 和聊天。

### 4. 安装前端依赖

```bash
npm ci --prefix web
```

启动器不会自动安装系统软件或前端依赖。后端依赖在 .NET 构建阶段还原。

### 5. 检查并启动

先启动 Docker Desktop 或 Docker Engine，再执行：

```bash
bash ./start.sh check dev
bash ./start.sh dev
```

Windows 可改为：

```powershell
.\start.ps1 check dev
.\start.ps1 dev
```

CMD 使用 `.\start.cmd`，参数相同。无参数启动等同于 `dev`。

启动器依次等待 PG / Redis 健康、构建 API、检查真实数据库健康接口，再启动 Vite。成功后访问：

- 原版首页：<http://localhost:5173/>
- 第二版首页：<http://localhost:5173/home-v2>
- API 健康检查：<http://127.0.0.1:8080/api/health>

未配置 SMTP、商户或 Designer 时，对应流程会明确返回不可用，不会切换到假数据或伪造成功。

## 启动与运维命令

| 操作 | 本地应用与基础设施 | 仅 PG / Redis |
| --- | --- | --- |
| 检查 | `bash ./start.sh check dev` | `bash ./start.sh check docker` |
| 启动 | `bash ./start.sh dev` | `bash ./start.sh docker` |
| 状态 | `bash ./start.sh status dev` | `bash ./start.sh status docker` |
| 日志 | `bash ./start.sh logs dev` | `bash ./start.sh logs docker` |
| 停止 | `bash ./start.sh stop dev` | `bash ./start.sh stop docker` |
| 帮助 | `bash ./start.sh help` | 同左 |

- 默认 API / Web 端口为 `8080` / `5173`，仅绑定 loopback；端口冲突会失败，不会自动杀进程或更换端口。
- PG / Redis 默认发布到 `127.0.0.1:5432` / `127.0.0.1:6379`，可通过配置调整宿主机端口。
- Ctrl+C 或 `stop dev` 只停止本启动器管理的本地进程；PG / Redis 保持运行。
- `stop docker` 显式停止基础设施并保留数据卷。不要在 API 使用数据库时停止它们。
- 任一本地应用进程意外退出时，启动器会关闭另一个并返回失败。
- 日志和进程状态保存在被忽略的 `.runtime/`，可能包含敏感信息，不应公开分享。
- 开发控制接口仅监听随机 loopback 端口并校验随机令牌；Windows 应配置个人受限目录权限。
- 异常退出后若存在 `.runtime/dev.lock`，先核实记录的进程和服务已停止，再移除陈旧锁；不要仅凭 PID 猜测杀进程。
- `status docker` 使用 Compose 的状态输出，不代表完整业务健康验收。

## 配置说明

启动器的 API 配置优先级：

```text
进程环境变量 > 可选 .env.dev > deploy/.env
```

这是本地启动器的行为；独立启动或生产 API 不会自动读取这些环境文件。

| 配置分组 | 用途 |
| --- | --- |
| `POSTGRES_PASSWORD`、`POSTGRES_PORT` | 本地 PG 口令及宿主机端口 |
| `REDIS_PASSWORD`、`REDIS_PORT` | Redis 认证及宿主机端口 |
| `Auth__SigningKey`、`Auth__Issuer`、`Auth__LifetimeHours` | JWT 签名、签发者与有效期 |
| `Mail__*` | SMTP 主机、端口、认证、发件人及 TLS |
| `Designer__*` | Designer 地址、票据签名密钥及服务端兑换密钥 |
| `Payments__PublicBaseUrl`、`Payments__WebBaseUrl` | API / Web 对外地址 |
| `Payments__Wechat__*` | 微信商户、签名、API v3 密钥及平台证书 |
| `Payments__Alipay__*` | 支付宝应用、商户身份及签名验证配置 |
| `Legal__Ready`、`Legal__OperatorName`、`Legal__ContactEmail` | 正式法务审核状态与运营主体信息 |
| `Proxy__KnownProxies__0` | 实际可信反向代理地址 |

完整键名见 [部署环境示例](deploy/.env.example) 和 [本地覆盖示例](.env.dev.example)。

### 数据库和 Redis

PG 数据库名和用户名均为 `vizora`。启动器从进程环境与 `deploy/.env` 取得 PG / Redis 口令及端口，并生成本地数据库连接串；不要把基础设施口令放到 `.env.dev`。

本地混合启动不会允许通过 `ConnectionStrings__Main` 悄悄切换数据库；独立测试或生产运行时则需要自行注入对应连接配置。

首次创建 PG 数据卷时自动执行 [schema.sql](db/schema.sql)。已有数据卷不会自动迁移，必须先备份，再按 [API 运维说明](api/CONTRACT.md) 执行升级并验证。

**不要通过重设环境口令、删除卷或重新初始化数据库来绕过连接错误。** Redis 已启用 AOF，但这不替代备份策略，也不代表业务缓存已接入。

### SMTP

在本地 `.env.dev` 设置 `Mail__Host`、`Mail__Port`、`Mail__User`、`Mail__Password`、`Mail__From` 和 `Mail__EnableSsl`。示例文件中的配置行需要按需取消注释。

- `465`：启用 TLS 时使用隐式 TLS。
- 其他启用 TLS 的端口：必须使用 STARTTLS，不会在协商失败后降级明文。
- 明文 SMTP：仅允许 Development 环境的 loopback 捕获服务。
- 用户名和密码必须成对配置。使用邮箱服务商要求的授权码，不要提交真实凭据。
- 正式邮件投递、退信和故障告警需要独立验证；SMTP 单元测试不会向真实邮箱发送邮件。

### Designer、支付与法务

- Designer 是独立服务，需配置 URL、票据签名密钥和服务端兑换密钥；不得把长期 Bearer token 放入 URL。
- 微信 Native 使用另一设备扫描二维码；同机微信 H5 / JSAPI 不在当前范围。
- 支付宝采用电脑网站支付。支付回跳页面不能自行发放权益。
- 本地启动器固定 Development、loopback 地址及本地回跳路径，不能用作正式支付宿主。
- 生产 `Legal__Ready` 只能在运营主体与法律材料完成审核后开启；它是人工审核声明，不是自动合规认证。

## 数据库与核心流程

核心表包括：

| 领域 | 表 |
| --- | --- |
| 账号与令牌 | `users`、`account_tokens` |
| 套餐与会员 | `plans`、`memberships` |
| 用户项目 | `dashboards` |
| 订单与支付 | `orders`、`payment_events` |
| 退款与权益 | `refunds`、`entitlement_grants`、`entitlement_review` |
| Designer 票据 | `ticket_nonces` |
| 企业咨询 | `sales_leads` |

关键约束：

1. 注册密码为 12–256 位；验证令牌有效期 30 分钟、单次使用，服务端仅存哈希。
2. 未验证邮箱不能登录；重置密码和注销全部会话通过 `token_version` 撤销旧 JWT。
3. 项目创建校验有效配额，访问和删除校验所有权。`dashboards` 不等于大屏运行引擎。
4. 订单金额和期限来自服务端套餐并保存快照，不信任浏览器提交的金额。
5. 支付确认先校验商户、签名和金额，再在事务中幂等更新订单及权益。
6. 固定期限会员不自动续费；有效期内仅支持同档续期，异档新购会明确拒绝。
7. 迟到或并发异档付款需人工复核，不能把“已付款”直接展示为“权益已生效”。
8. 退款 `processing` 不是成功；商户最终确认后才撤销对应权益，复杂叠加情形进入人工复核。
9. Designer 票据有效期两分钟且只能兑换一次，由外部服务建立自己的会话。
10. 咨询须记录隐私同意并持久保存，接口成功不等于销售人员已经处理。

接口路径、字段、错误格式及集成复现说明见 [API 契约](api/CONTRACT.md)。

## 测试与验证

### 构建与单元测试

在仓库根目录执行：

```bash
# 前端类型检查与生产构建
npm run build --prefix web

# 前端单元与回归测试
npm test --prefix web

# API Release 构建
dotnet build api/Vizora.Api.csproj -c Release

# SMTP 配置单元测试，不访问外部邮件服务器
dotnet test tests/api-unit/Api.UnitTests.csproj

# 启动器及生产就绪检查器单元回归
node --test tests/startup.test.mjs tests/production-readiness.test.mjs
```

生产前端产物输出到 `web/dist/`。构建成功不等于运行环境、真实数据或外部服务已验收。

### 数据库与 SMTP 集成测试

必须使用名称以 `vizora_test` 开头的独立测试数据库，以及 loopback API 和 SMTP 捕获服务。

1. 在本机受控环境注入 `TEST_DB_CONNECTION`，不要把连接串写入文档或命令历史。
2. 按 [API 运维说明](api/CONTRACT.md) 初始化数据库、启动 SMTP 捕获器及测试 API。
3. 运行实际接口和领域测试：

```bash
node tests/api-integration.mjs
dotnet run --project tests/api-integration/Api.Integration.csproj -- commerce
```

测试覆盖注册验证、密码恢复、会话撤销、并发配额、项目 CRUD、咨询持久化、未配置外部服务及会员权益边界。**不得指向生产或共享数据库，也不得将领域夹具当成真实商户验收。**

### 浏览器验收

建议使用独立 Python 虚拟环境安装浏览器测试依赖：

```bash
python3 -m pip install -r tests/requirements-ui.txt
python3 -m playwright install chromium
```

先按各脚本要求启动独立测试 Web / API，注入测试地址和专用账号后运行：

- [逐页与主流程](tests/ui_e2e.py)：响应式布局、导航、表单、项目、咨询与账单。
- [账号流程](tests/ui_auth_e2e.py)：真实 SMTP 捕获、重发、验证、密码恢复及移动端登录。
- [业务边界](tests/ui_business_edges.py)：项目配额、删除释放及未配置外部服务的明确失败。
- [会员策略](tests/ui_membership_e2e.py)：同档续期、异档保护及历史订单边界。

用 `UI_BASE_URL`、`UI_TEST_EMAIL`、`UI_TEST_PASSWORD` 等环境变量提供脚本所需配置，具体以各脚本为准。不要使用生产账号，也不要用网络拦截或伪造 API 成功代替真实链路。

### 验证记录的解读

- 第二版首页开发时，38 项前端回归、类型检查与生产构建通过；浏览器检查覆盖 1440 / 1024 / 768 / 390 / 320px、示例和团队切换、需求保存、匿名跳转、菜单焦点、存储失败与原版元信息恢复。
- SMTP 修改时，14 项配置单元测试、API Release 构建和 11 项启动脚本回归通过；该轮未进行真实邮件投递。
- 历史隔离环境曾完成 27 项 API 断言、13 项数据库领域回归及 90 项 API / UI 检查；这些记录不代表当前机器已启动同一环境。
- 历史 `tests/check*.py` 是静态源码契约检查，部分断言依赖旧文件布局；失败与否不能替代实际构建或运行时证据。
- 测试结果与依赖核查都有时间和环境边界，不应将历史通过记录表述为持续的生产保证。

## 生产部署

**本仓库的启动器用于本地开发，不是生产发布方案。** [Compose](deploy/compose.yml) 仅管理 PG / Redis，不部署 API、Web 或 Nginx。

生产部署至少需要：

1. 完成真实运营主体、适用备案、服务协议、隐私与退款政策审核。
2. 在受控服务端配置数据库、JWT、SMTP、商户证书、Designer 和回调地址。
3. 对数据库执行备份、迁移、恢复和回滚演练，保持 PG / Redis 不暴露公网。
4. 构建前端生产资源与 Release API，使用受控进程管理部署。
5. 单独配置静态资源托管、SPA 回退、HTTPS 和 `/api` 转发，不强制使用 Nginx。
6. 验证真实 SMTP、商户付款与最终退款、Designer 兑换、异常对账、日志脱敏及告警。

仅需启动基础设施时：

```bash
docker compose -f deploy/compose.yml --env-file deploy/.env up -d --wait postgres redis
```

该命令不构成完整网站部署；读取 Compose 环境文件不会自动为独立运行的 API 注入配置。

### 生产就绪检查

在与 API 相同的受控配置环境中执行：

```bash
node scripts/production-readiness.mjs
```

检查器要求 `ASPNETCORE_ENVIRONMENT=Production`；如果设置了 `DOTNET_ENVIRONMENT`，也必须为 `Production`。它只读取进程环境变量，输出配置键名及状态，不读取 `.env`、不输出配置值、不联网，也不会创建订单。

检查内容包括必要配置、显式 SMTP TLS、法务门禁、公开 HTTPS 地址、回调 origin / 路由和部分密钥结构。若 API 使用额外配置提供程序，须将检查器接入同一来源，否则不能据此判定就绪。

**检查通过不等于**公网回调可达、证书可信、商户身份正确、法务已审核或真实交易已成功。完整清单见 [上线门禁](RELEASE_GATE.md)，未完成的外部能力不能宣称已正式上线。

## 常见问题

### API / Web 端口被占用

先识别端口所属进程并确认是否为自己的服务，再按其管理方式停止。启动器不会自动杀进程或切换默认应用端口。

### 修改 `.env` 后数据库认证失败

已有 PG 数据卷不会因修改 `POSTGRES_PASSWORD` 自动更新数据库内的口令。核对原配置并按数据库管理流程处理，不要删除数据卷或覆盖旧凭据。

### 注册或密码恢复提示邮件不可用

检查 SMTP 主机、端口、TLS、发件人及成对的认证信息，确保邮箱服务商授权和网络条件有效。单元测试通过不能证明实际 SMTP 投递成功。

### Designer 或支付入口返回不可用

先检查对应服务端配置，再验证真实集成。未配置时的明确失败是预期行为，不应使用假二维码、假会话或前端成功状态掩盖问题。

### 直接访问 `/home-v2` 或其他路由返回 404

生产静态资源服务需要将非静态文件路径回退到前端 `index.html`，同时将 `/api` 正确转发至 API。Vite 开发访问成功不代表生产回退已配置。

### 为什么没有 API / Web 容器？

当前约定是 PG / Redis 容器与本机 API / Vite 混合开发。若环境中仍有旧版应用容器，应先核对归属再停止；启动器不会擅自删除孤立容器。

## 开发与贡献

欢迎通过 [GitHub Issues](https://github.com/zhouguoqing/vizora-ai-v4.2/issues) 提交复现步骤或通过 Pull Request 改进项目。

- 保持 Vue / TypeScript、原生组件和 REST API 的现有架构，避免重复建设设计器。
- 修改前阅读相关契约；保持错误、空态、加载态、过期态和响应式行为一致。
- 针对变更运行最小相关测试，并同步更新文档；涉及数据库或支付时提供真实隔离环境证据。
- 不提交环境文件、密钥、私钥、数据库备份、真实账号、日志或会话令牌。
- Issue 和 PR 仅附脱敏信息；不要公开上传潜在的可利用漏洞细节或客户业务数据。
- 提交视觉素材时确认拥有使用与分发权，不将示例标识、指标或图表冒充真实客户背书。

## 相关文档

- [概要设计](docs/概要设计.md)
- [UI 原型](docs/UI/)
- [项目约束与实现记忆](AGENTS.md)
- [API 契约与运维验证](api/CONTRACT.md)
- [正式上线门禁](RELEASE_GATE.md)
- [部署环境配置示例](deploy/.env.example)
- [本地覆盖配置示例](.env.dev.example)

## 许可证

本项目采用 [MIT License](LICENSE)，允许在遵守许可证条件的前提下使用、复制、修改、分发及商业使用。分发源码或其重要部分时，须保留版权声明与许可声明；软件按现状提供，不附带担保。

第三方依赖遵循各自许可证；MIT 授权不替代商标许可、外部 Designer / 邮件 / 支付服务协议或其他权利人的授权，也不表示项目已通过正式商业运营验收。
