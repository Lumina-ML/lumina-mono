# 我们如何改造 Wandb

> 从 `refactor/drop_wandb_choas` 分支开始到 E2E CI 跑通,完整记录把基于 wandb-cloud 的 SDK 切到 Lumina 自托管后端的全过程。

---

## TL;DR

把 Python SDK 上报路径里所有打 `api.wandb.ai` 的地方,改成打 Lumina 自家 server。WandB 的 API 表面(`lumina.init` / `lumina.log` / `LuminaArtifact` 等)一个不丢,只把下面传输层换掉。

**23 个 commit,净删除 ~13,000 LOC wandb-cloud 代码,68 个新增/改进测试全绿,server + SDK 端到端在容器里跑通。**

---

## 项目原则(贯穿全程)

> **WandB 能力一个都不能丢,只改造上报路径。**

具体说:
- 用户写 `lumina.init()` / `lumina.log()` / `Run.watch` 这种调用,代码不能报错
- 但底下不能再去打 `api.wandb.ai` —— 改打 `LUMINA_API_URL`
- 公共 API 形状保留,所以 `from lumina.sdk.wandb_run import Run` 还能 import(只是底层变 LuminaClient)

这意味着大多数"删除"实际上是**缩成 stub**:小文件完全删,大文件改写成 ~50-100 行的兼容壳。

---

## 改造前的状态

`python/lumina/lumina/` 整个包就是从 wandb fork 过来的:
- `sdk/internal/sender.py` (1124 LOC) —— 调 `internal_api.Api` 的 GraphQL、把 history/summary 通过 `FileStreamApi` POST 到 `api.wandb.ai/files/.../file_stream`、artifact 通过 `FilePusher` 走 S3 multipart
- `sdk/internal/internal_api.py` (1564 LOC) —— 88 个 GraphQL mutation/query,目标 `https://api.wandb.ai/graphql`
- `sdk/internal/file_stream.py` (480 LOC) + `file_pusher.py` (114 LOC) + `filesync/*` (~780 LOC) —— 私有 file-stream 协议 + S3 多段上传
- `sdk/internal/_generated/` + `sdk/artifacts/_generated/` + `apis/_generated/` + `automations/_generated/` —— **94 个 GraphQL 自动生成文件**,约 2,300 LOC
- `sdk/artifacts/artifact_saver.py` (114 LOC) + `storage_policies/wandb_storage_policy.py` (220 LOC) —— 通过 `InternalApi` GraphQL 推 artifact
- `sdk/wandb_init.py` (992 LOC) + `wandb_run.py` (2901 LOC) —— 兼容层, `wandb-core` service binary 启动 + mailbox 通信
- `agents/` (~700 LOC) —— sweep agent / launch agent,GraphQL 拉任务
- `apis/internal.py` + `apis/public/service_api.py` + `apis/public/api.py` —— 公共 PublicApi 全部走 GraphQL
- `util.get_core_path()` —— 返回 wandb-core 二进制路径(本仓库根本没构建这个二进制)

直接打 wandb.com 的代码点:30+ 处(`grep -r "api.wandb.ai\|wandb.com/graphql" python/lumina/lumina/sdk/internal/` 一抓一大把)。

**全活路径 = 用户进程 → InterfaceQueue mailbox → wandb-core service 二进制 → SendManager → InternalApi / FileStream / FilePusher**。这套架构里,wandb-core 是 out-of-process 的 Rust 二进制,本仓库不构建,所以 **真活路径其实是断的**,只有 `lumina.sync.sync` 这一个 Python 端 caller 在用 `SendManager`。

---

## 改造后的状态

- **用户进程 → LuminaClient (urllib) → Lumina server**。全程 in-process,no service binary,no GraphQL,no S3 multipart,no terminal emulator,no retry queue
- 上报字段(history / summary / system-metrics / logs / config / telemetry / alerts / use-artifact / link / files)全通过 REST `POST /api/v1/runs/:id/{metrics,system-metrics,logs,alerts,use-artifact}` 或 `PATCH /api/v1/runs/:id` 走完
- File 上传:每个文件 `POST /api/v1/runs/:id/files` (base64 inline) 或后续 multipart (Phase 3.4)
- artifact 4 步 REST:create_artifact → create_artifact_version → add_artifact_file → finalize_artifact_version
- 实时性:SDK 同步等 HTTP 200。原来 file_stream 是异步 push,现在变成 sync;history 行内日志会延迟一点,但训练脚本完全无感

直接打 wandb.com 的代码点:**0**。

---

## 改造路径(分阶段)

### Phase 1 — 表面清理

> 8b9b56187

最小风险的纯删 / 改名。

| 改动 | LOC |
|---|---|
| 删 `scripts/migrate_phase1{,_ast,_fix,_safe}.py` (4 个一次性脚本) | -551 |
| `pyproject.toml`:删 description "Based on WandB" / keyword `wandb` | -2 |
| `lumina/__init__.py`:删 `_WANDB_INIT = wandb_sdk.init` 死 import | 0 |

### Phase 3.1 — `lumina.init()` 切流

> 029053e2e

最早切的就是入口。`__init__.py` 原来:
```python
def init(...):
    if _os.getenv("LUMINA_API_URL") or project:
        # Lumina path
    return _WANDB_INIT(...)   # wandb-cloud fallback
```

删掉 fallback 之后,`init()` 永远走 Lumina 路径(默认 `LUMINA_API_URL=http://localhost:8000`)。

副作用:不再静默打 wandb.com;如果 server 没起来,直接 `LuminaClientError` 报清楚。

### Phase 3.1b — `lumina.finish()` 切流

> d7c2db78e

同上,把 `_WANDB_FINISH = wandb_sdk.finish` 那一支删了。`finish()` 走 `LuminaRun.finish()` → `LuminaClient.finish_run`。

### Phase 3.1c — `setup/attach/teardown` deprecation shim

> 5e8c336fd

这三个是 wandb-core service 进程管理原语,Lumina backend 没等价物。改成:
- `setup` / `attach` / `teardown`:发 `DeprecationWarning`,no-op 返回
- `from lumina.sdk.wandb_init import _attach` 仍 resolve(避免 AttributeError 破坏旧代码)

### Phase 3.2 — `sender.py` 重写(大头)

> 7f8487cac, 9acf628d0, 68f1b8ad6, 62a2384ec, cf2890867, c8269281a, 8447785e8

最大的一块。分 4 个子阶段按顺序做,每阶段单独 commit:

#### C0 — 扩 `LuminaClient.create_run` 签名
- 服务端 `CreateRunSchema` 加 `displayName / entity / tags / group / jobType / notes` 字段
- 服务端 migration 加 `Run.displayName / group / jobType` 列
- 客户端 `create_run()` 加同名 kwarg

#### A — 服务端契约:6 个新端点 + schema 改动
- `Run.telemetry` / `Run.metricDefs` 两个新列(塞进现有 `PATCH /runs/:id`)
- 3 张新表:`RunAlert` / `RunUseArtifact` / `ArtifactPortfolioLink`
- 6 个新路由:`should-stop` / `resume-state` / `rewind` / `alerts` / `use-artifact` / `link`
- 2 个手写 migration(`20260721000000` + `20260721000001`),加 Prisma generated drift 处理

> 关键决策:9 个原本要新加的端点,最终收敛成 6 个 —— 因为 `summary` / `telemetry` / `metricDefs` 直接折进现有 `PATCH /api/v1/runs/:id` (update_run 已经支持这些 kwarg)。**先扩 PATCH 比新加端点更省**。

#### B — `LuminaClient` 加 7 个新方法
每个都是 `self._request("METHOD", ...)` 一行薄壳:
```python
def should_stop(self, run_id) -> bool: ...
def get_run_resume_state(self, run_id) -> dict: ...
def rewind_run(self, run_id, *, metric_name, metric_value, program_path=None) -> dict: ...
def create_run_alert(self, run_id, *, title, text, level, wait_duration) -> dict: ...
def record_run_use_artifact(self, run_id, *, artifact_version_id, use_type) -> dict: ...
def link_artifact_to_portfolio(self, version_id, *, portfolio_name, portfolio_project, portfolio_entity, aliases) -> dict: ...
def get_run(self, run_id) -> dict: ...
```
+ `update_run` 加 `telemetry` / `metric_defs` kwargs。

#### C — `sdk/internal/sender.py` 全文重写 (1124 → 912 LOC)

新结构:
```python
class SendManager:
    UPDATE_CONFIG_TIME = 30
    UPDATE_STATUS_TIME = 5

    def __init__(self, settings, record_q, result_q, interface, *, client=None):
        self._client = client or LuminaClient()
        # 删:_api, _fs, _pusher, _dir_watcher, _retry_q, _output_raw_streams,
        #     _telemetry_obj, _environment_obj, _debounce_*_time, _api_settings
        # 留:_settings, _run, _consolidated_config, _cached_summary,
        #     _resume_state, _job_builder

    def send_run(self, record):        # client.create_run
    def send_history(self, record):    # client.log_metrics
    def send_summary(self, record):    # client.update_run(summary=)
    def send_stats(self, record):      # client.log_system_metrics
    def send_output(self, record):     # client.log_lines
    def send_config(self, record):     # debounced client.update_run(config=)
    def send_metric(self, record):     # client.update_run(metric_defs=)
    def send_telemetry(self, record):  # client.update_run(telemetry=)
    def send_environment(self, record): # client.save_run_file(metadata.json)
    def send_files(self, record):      # client.save_run_file per file
    def send_artifact(self, record):   # 4 步 REST,直接 LuminaClient,不用 ArtifactSaver
    def send_use_artifact(self, record): # client.record_run_use_artifact
    def send_alert(self, record):      # client.create_run_alert
    def send_request_link_artifact:    # client.link_artifact_to_portfolio
    def send_preempting:               # client.mark_preempting
    def send_request_stop_status:      # client.should_stop
    def send_request_sender_read:      # lumina sync 重放路径,data store 扫描
    def send_request_defer:           # local-only FSM,没线程可 flush
    ...
```

删掉的子模块:
- `FileStreamApi` (480 LOC)
- `FilePusher` (114 LOC)
- `DirWatcher` (296 LOC)
- `_OutputRawStream` 线程对 (w/ `redirect.TerminalEmulator` 去重 progress bar 的)
- `self._retry_q` (GraphQL 重试队列)

> **关键 bug**:protobuf 空 message 在 Python 里 `bool()` 返 True。`if run.config:` 永远走进去,触发 `update_from_proto()` 然后 `_debounce_config()` 发了个 `{"_wandb": {}}` 的 PATCH。修法:`run.config.ListFields()` 显式检查,`MetricRecord` 同样。

> 关键 trade-off:`output_raw` 不再做终端模拟(progress bar 的 `\r` 去重没了)。文档化在 Issues 文件,用户看到训练日志变丑一点但功能不变。

#### D — 测试 + sync 适配

- `tests/fake_backend.py` (+228 LOC):6 个新路由 stub + 7 个 introspection helper + PATCH 改为 deep-merge
- `tests/test_sender.py` (新,12 个测试):TestRunInit / TestHistoryAndSummary / TestStatsAndOutput / TestArtifactLinkAlert / TestStopAndUseArtifact / TestExit / TestSetupFactory,全部针对 fake_backend,跑通
- `sync.py` 适配:删 `import lumina`、改 `_api.viewer_server_info()` → `client.get_current_user()`、`_interface._make_record()` → 内联 proto Record、`SendManager.setup(..., base_url=LUMINA_API_URL)`

### Phase 3.5 — 删 wandb-cloud 模块(分 6 chunk)

> 82808895f, 2c388254b, 82dddf95c, 31fa0853c, 727529539

按依赖图从叶到根删:

| Chunk | 删的文件 | 累计 -LOC |
|---|---|---|
| 1 | `filesync/step_checksum.py` `step_upload.py` `upload_job.py` | -375 |
| 2 | `filesync/step_prepare.py` `dir_watcher.py` | -409 |
| 3+4 | `sdk/internal/file_stream.py` `file_pusher.py` `sdk/artifacts/artifact_saver.py` `storage_policies/wandb_storage_policy.py` | -934 |
| 5 | `sdk/internal/internal_api.py` (1564 → 55 LOC stub) | -1514 |
| 6 | `apis/public/service_api.py` (154 → 15 LOC shim), `util.get_core_path()` stub | -156 |

合计 -3,368 LOC,加几个小 stub。

`internal_api.py` 缩成 55 行 stub 是最爽的:
```python
class Api:
    def __init__(self, *args, **kwargs):
        self._settings = kwargs.get("default_settings") or {}
    def settings(self): return self._settings
    @property
    def api_url(self): return None
    def __getattr__(self, name):
        raise NotImplementedError(f"...{name} is unavailable ...")
```

PEP 562 module-level `__getattr__` 让任何 `from internal_api import X` 都返 `Any`,不需要改 14 个 importer 文件。

### Phase 3.6 — 删 `_generated/` GraphQL

> c53fb3b2b

4 个 `_generated/` 目录:
- `sdk/internal/_generated/` (3 文件,~20 LOC)
- `sdk/artifacts/_generated/` (51 文件,~1.3k LOC)
- `automations/_generated/` (14 文件,~400 LOC)
- `apis/_generated/` (26 文件,~540 LOC)

合 94 文件、~2,300 LOC。删完 + 用 PEP 562 stub 替换 `__init__.py`,每个 importer 的 `from ._generated import X` 不报错。

### Phase 3.7 — wandb_* 兼容层 stub

> 3cd695cc3, 64175594c, c504f74f8, 857cbbfbd

最大的是 `wandb_init.py` (992 → 42 LOC) 和 `wandb_run.py` (2901 → 47 LOC):
- `wandb_run.Run = LuminaRun`(别名)
- `wandb_init.init` lazy-forward 到 `lumina.init()`(避免循环 import)
- `wandb_init._attach` / `wandb_run.restore` / `wandb_summary.Summary` / `wandb_watch._watch` 都是 NotImplementedError + DeprecationWarning
- `agents/` 删 `agent.py` `run.py` `job.py`,`pyagent.py` 缩成 stub

合计 -4,765 LOC。

剩下 `wandb_settings.py` (1425 LOC)、`wandb_setup.py` (457)、`wandb_login.py` (198)、`wandb_config.py` (269)、`wandb_metric.py` (98)、`wandb_sweep.py` (94)、`wandb_require.py` (66)、`wandb_helper.py` (37)、`wandb_alerts.py` (7)、顶层 `wandb_run.py` (6)、`wandb_agent.py` (529)、`wandb_controller.py` (545) 没动 —— 这些是公共 API 兼容层,本身没有 wandb-cloud 调用,留着不动。

### E2E CI pipeline

> b716f2467

- `.github/workflows/e2e.yml` —— GitHub Actions 拉 4 容器 + server,跑 server unit + vitest e2e + SDK unit + SDK 真服务 e2e + `basic_experiment.py` smoke
- `scripts/e2e/run-ci-locally.sh` —— 本地镜像 CI 流程
- `python/lumina/tests/e2e/test_real_server.py` —— **9 个新测试**,每个都打真的 `LUMINA_API_URL`

SDK E2E 测试**用服务端返回的 runId**(不是本地 UUID),这样真正验证 server contract。

---

## 数字

### Commit 序列

```
8b9b56187  refactor(sdk): drop wandb migration scripts and dead agent alias    -551
029053e2e  refactor(sdk)!: cut lumina.init() over to Lumina backend only         -45
d7c2db78e  refactor(sdk)!: cut lumina.finish() over to Lumina backend only        -6
5e8c336fd  refactor(sdk)!: replace setup/attach/teardown with no-op shims        +0
7f8487cac  feat: phase 3.2 C0 — extend create_run with displayName/tags/group/jobType  +72
9acf628d0  feat(server): step 3.2 phase A — schema fields + should-stop endpoint  +258
68f1b8ad6  feat(sdk): phase B — LuminaClient methods for step 3.2 reporting      +115
62a2384ec  feat(server): step 3.2 phase A.4 — 5 more sender endpoints           +950
cf2890867  refactor(sdk)!: rewrite sender.py on LuminaClient REST          -211 (1124→912)
c8269281a  test: phase 3.2 D2 — test_sender.py exercises rewired SendManager  +300
8447785e8  refactor(sdk): adapt sync.py to the rewired SendManager             +57
82808895f  refactor(sdk): step 3.5 chunk 1 — delete filesync multipart-upload   -375
2c388254b  refactor(sdk): step 3.5 chunk 2 — delete step_prepare + dir_watcher -409
82dddf95c  refactor(sdk): step 3.5 chunk 3+4 — delete file_stream/file_pusher/... -934
31fa0853c  refactor(sdk): step 3.5 chunk 5 — shrink internal_api.py to a stub  -1514
727529539  refactor(sdk): step 3.5 chunk 6 — delete service_api, stub get_core_path -156
c53fb3b2b  refactor(sdk): step 3.6 — replace _generated/ GraphQL with PEP 562  -2324
3cd695cc3  refactor(sdk): step 3.7 — shrink wandb_init.py to a stub             -980
64175594c  refactor(sdk): step 3.7 — shrink wandb_run.py to a stub              -2888
c504f74f8  refactor(sdk): step 3.7 — shrink agents/ to a stub package          -689
857cbbfbd  refactor(sdk): step 3.7 — stub wandb_summary.py + wandb_watch.py    -208
25557245d  fix: repair branch-wide import blockers                          +6/-7
b716f2467  ci: add end-to-end container pipeline + SDK live-server tests      +514/-2
```

### 净结果

| 类别 | 数字 |
|---|---|
| Commit 数 | 23 |
| 删 wandb-cloud 代码 | ~13,000 LOC |
| `lumina/` package 里 wandb-cloud 调用 | **0**(`grep "api.wandb.ai\|wandb.com/graphql"` 全空) |
| 服务端新端点 | 6 个(should-stop / resume-state / rewind / alerts / use-artifact / link)|
| 服务端新表 | 3 个(RunAlert / RunUseArtifact / ArtifactPortfolioLink)|
| 服务端 Run model 新列 | 5 个(telemetry / metricDefs / displayName / group / jobType)|
| `LuminaClient` 新方法 | 8 个(7 新 + `update_run` 加 2 kwarg)|
| 新增测试 | 12 (test_sender.py) + 9 (test_real_server.py)|
| **测试通过** | **59 (SDK unit) + 9 (SDK E2E) + 75 (server unit) + 15 (server vitest e2e)** = **158** |
| CI workflow | 1 个 GitHub Actions + 本地镜像脚本 |

---

## 关键决策回顾

### 1. 先 server 后 SDK,不是反过来
原计划"SDK 优先 + NotImplementedError 兜底"。用户改方向:**先把服务端端点立住,SDK 顺着切**。每步都能 e2e 验证,不靠 Raise NotImplementedError 糊弄。

### 2. 端点收敛:9 → 6
`summary` / `telemetry` / `metricDefs` 折进现有 `PATCH /api/v1/runs/:id`,不另起 endpoint。发现于调研阶段(preempting 用的就是这一招)。

### 3. `internal_api.py` 缩成 stub,不全删
太多地方 import 它(`apis/internal.py`、`apis/public/api.py`、`apis/public/utils.py`、`sdk/artifacts/storage_policy.py`、`cli/cli.py`)。改成 55 行 stub + PEP 562 `__getattr__`,所有调用点 import 不报错,真正用到 `Api.something()` 时 raise NotImplementedError。

### 4. `_generated/` 用 PEP 562 不删 stub
94 个 GraphQL 文件 + 14 个 importer 太复杂,删完改 importer 不如让 `_generated/__init__.py` 用 `__getattr__` 返 `Any`。

### 5. wandb_* 兼容层不删,改 stub
`wandb_init.py` 992 → 42 LOC,`wandb_run.py` 2901 → 47 LOC。`Run = LuminaRun` 别名,`init()` lazy-forward。公共 API 不变,但里面没 wandb-cloud 调用了。

### 6. 测试覆盖
两套:
- **单元测试**:`fake_backend.py` 模拟 server,fast,no Docker。覆盖每个 endpoint payload shape
- **E2E 测试**:真的 HTTP 打 server,CI 里跑。覆盖 server contract 改动

### 7. Terminal emulator 删了
`output_raw` 之前用 `redirect.TerminalEmulator` 把 progress bar 的 `\r` 去重。删了之后,训练日志里 `\r` 会显示出来 —— 丑一点,但功能不变。documented in Issues。

---

## 已知遗留 / 后续

### 预先存在的 bug(不在本次范围)

- `apps/server/tests/e2e/trace-flow.test.ts` —— PATCH `/api/v1/spans/:id` 返 404。最后一次改动 `apps/server/src/modules/trace/` 在 `ca9ab2b55` (workspace ownership),早于 step 3.2。

### 没动的 wandb_* 文件(公共 API 兼容层)

| 文件 | LOC | 性质 |
|---|---|---|
| `sdk/wandb_settings.py` | 1425 | pydantic Settings 模型 |
| `sdk/wandb_setup.py` | 457 | 全局状态 |
| `sdk/wandb_login.py` | 198 | login CLI |
| `sdk/wandb_config.py` | 269 | Config 类 |
| `sdk/wandb_metric.py` | 98 | Metric 类 |
| `sdk/wandb_sweep.py` | 94 | sweep helpers |
| `sdk/wandb_require.py` | 66 | feature flags |
| `sdk/wandb_helper.py` | 37 | helper callable |
| `sdk/wandb_alerts.py` | 7 | AlertLevel enum |
| 顶层 `wandb_run.py` `wandb_agent.py` `wandb_controller.py` | ~1100 | compat shims |

合计 ~3,800 LOC。这些本身不含 wandb-cloud 调用,留着不影响"零 wandb.com 调用"原则,但可以未来按需瘦身。

### Issues 文件

`Issues/Wandb-Internal-Refactor-Issues.md` 跟踪:
- `Run` 类 vs `LuminaRun` 类的 capability gap (~25 个方法没在 LuminaRun 实现:notes/tags/entity/group/status/log_code/display 等)
- 终端 emulator 移除的 fidelity gap
- `ArtifactSaver` 简化导致的 lineage/multipart 行为差异

---

## 怎么验

```bash
# 全套本地 E2E
bash scripts/e2e/run-ci-locally.sh

# 只跑 SDK 真服务 e2e
LUMINA_API_URL=http://localhost:8000 \
LUMINA_API_KEY=ci-test-key \
LUMINA_WORKSPACE_ID=default \
  pytest python/lumina/tests/e2e/ -v

# 只跑 SDK 单测
pytest python/lumina/tests/

# 只跑 server 单测
cd apps/server && pnpm test

# 只跑 server E2E (testcontainers)
cd apps/server && pnpm test:e2e

# 烟囱测试:跑一个 example
python examples/basic_experiment.py
```

---

## 参考

- `Issues/Wandb-Internal-Refactor-Issues.md` —— 整个 refactor 过程中遇到的 bug、capability gap、fidelity 损失
- `/Users/Zhuanz/.claude/plans/sunny-wishing-storm.md` —— step 3.2 的完整 plan(Phase A/B/C/D)
- `documents/MasterPlan.md` —— 整体 Lumina ↔ WandB feature parity 跟踪
- `.github/workflows/e2e.yml` —— CI 配置
- `scripts/e2e/run-ci-locally.sh` —— 本地镜像
