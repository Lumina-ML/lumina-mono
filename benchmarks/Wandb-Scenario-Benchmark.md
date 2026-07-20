# Wandb 场景基准测试（Wandb Scenario Benchmark）

> 目标：为 Lumina 建立一套覆盖 Wandb 核心能力、可分级数据量、最终用于产品验收的基准测试。
> 
> 状态：设计稿 2026-07-21。
>
> 更新 2026-07-21：第一批核心场景（ET-1 / ET-2 / AR-1 / SW-1 / PA-1）已实现并接入 `scenario_runner.py`。本地 docker compose 执行 AR-1 时，对象存储 presigned URL 使用内部 hostname（`minio:9000`），从宿主机无法直接访问，当前会标记为 skip；需在容器网络内执行或配置公共 S3 endpoint。
>
> 更新 2026-07-21：第二批核心场景（AR-2 / AR-3 / SW-2 / TR-1 / AW-1）已实现并接入 runner。AR-2 与 AR-1 受同一 S3 内网 hostname 限制会 skip；TR-1 当前验证 trace 创建与 project-scoped 列表，span tree 细节验证需等 workspace-guard 对 ClickHouse trace 的 authz 查询统一后补齐。

## 1. 设计原则

1. **能力覆盖优先于框架细节**  
   不追求把 Wandb 每一个历史 API 都复刻一遍，而是覆盖用户最常用、迁移时最关心的场景（实验追踪、指标、Artifact、Model Registry、Sweep、Launch、Eval、Trace、Report、Public API、多 Workspace）。
2. **分级数据量**  
   每个场景在 Small / Medium / Large / XLarge 四级数据量下跑，既能做 CI 快速回归，也能做发布前压测。
3. **真实后端 + 快速 fake backend 双模式**  
   - 日常开发/CI：使用 `python/lumina/tests/fake_backend.py` 或本地内存服务，验证 API 契约和正确性。
   - 验收/发版前：使用 `docker compose` 全栈（Postgres + ClickHouse + Redis + Server），验证真实吞吐与稳定性。
4. **可横向扩展**  
   新增场景时只需实现一个 `Scenario` 子类，统一由 `scenario_runner.py` 编排。

## 2. 测试维度

| 维度 | 说明 | 当前缺口 |
|---|---|---|
| **API Coverage** | 每个 SDK public API 至少一条 happy path | 缺少统一的 API smoke benchmark |
| **Data Volume** | Small / Medium / Large / XLarge | 现有 benchmark 数据量偏小（≤1k metrics） |
| **Concurrency** | 多 run 并行、多 agent 并发 sweep | 无并发 benchmark |
| **Read/Query** | metric 列表、summary 聚合、Public API 查询 | 无读侧 benchmark |
| **Correctness** | summary 聚合、artifact digest、lineage、sweep early-stop | 未系统验证 |
| **Multi-workspace** | 切换 workspace、跨 workspace 隔离 | AW-1 已实现 |
| **Storage Backend** | Postgres vs ClickHouse metrics；本地 vs S3 artifacts | 无后端对比 benchmark；TR-1 span 验证受 ClickHouse authz 缺口影响 |

## 3. 数据量级定义

| 级别 | Metrics / run | Steps / run | Log lines / run | Artifact size | Files / artifact | Spans / trace | Concurrent runs |
|---|---|---|---|---|---|---|---|
| **S** | 10 | 10 | 50 | 1 MB | 1 | 10 | 1 |
| **M** | 1,000 | 1,000 | 5,000 | 100 MB | 100 | 100 | 4 |
| **L** | 100,000 | 100,000 | 50,000 | 1 GB | 1,000 | 1,000 | 16 |
| **XL** | 1,000,000 | 1,000,000 | 500,000 | 5 GB | 10,000 | 10,000 | 64 |

> 注：Metric 指 `lumina.log()` 里一个 key 的一次取值；Step 指一次 `log()` 调用可含多个 key。

## 4. 场景矩阵

每个场景都标注：
- **覆盖的 SDK API**
- **建议先跑的级别**
- **主要指标**
- **正确性断言**

### 4.1 实验追踪（Experiment Tracking）

| ID | 场景 | SDK API | 级别 | 主要指标 | 断言 |
|---|---|---|---|---|---|
| ET-1 | 单次运行完整生命周期 | `init`, `log`, `config`, `summary`, `finish` | S/M/L | `runs/sec`, `points/sec` | run 状态为 finished；summary 聚合正确 |
| ET-2 | 大量 scalar metric 写入 | `log` | S/M/L/XL | `points/sec`, p95 latency | 后端返回的 metrics 总数 = 写入数 |
| ET-3 | System metrics + console logs | `log_system`, `log_line` | S/M/L | `lines/sec`, `system_points/sec` | log 按 step 可检索 |
| ET-4 | Resume / rewind / mark_preempting | `mark_preempting`, run resume | S | 恢复后 metric 连续 | 恢复 run 的 step 从断点继续 |
| ET-5 | Tags & notes | `add_tag`, run notes | S | — | tag 可见、notes 持久化 |

### 4.2 Artifact & 模型注册（Artifacts & Model Registry）

| ID | 场景 | SDK API | 级别 | 主要指标 | 断言 |
|---|---|---|---|---|---|
| AR-1 | Artifact 上传/下载/校验 | `LuminaArtifact.add_file`, `save`, `use_lumina_artifact` | S/M/L | `MB/sec`, finalize latency | digest 一致、下载后字节一致 |
| AR-2 | 大量小文件 artifact | `add_file` × N | S/M/L | `files/sec` | manifest 文件数正确 |
| AR-3 | Artifact lineage / alias | `link_artifacts`, `unlink_artifacts`, `artifact_lineage` | S | lineage 图正确 | upstream/downstream 关系可查询 |
| MR-1 | log_model / use_model / link_model | `log_model`, `use_model`, `link_model` | S/M | model 版本可用 | alias 指向最新版本 |

### 4.3 Media & Tables

| ID | 场景 | SDK API | 级别 | 主要指标 | 断言 |
|---|---|---|---|---|---|
| MD-1 | Image / Video / Audio / Plotly 日志 | `lumina.log({"image": wandb.Image(...)})` | S/M | media 可渲染 | media artifact 可下载 |
| MD-2 | LuminaTable 与 confusion matrix | `LuminaTable`, `lumina.log` | S/M | table 序列化/反序列化 | table 行数正确 |

### 4.4 Sweeps

| ID | 场景 | SDK API | 级别 | 主要指标 | 断言 |
|---|---|---|---|---|---|
| SW-1 | Bayesian sweep + early termination | `sweep`, `agent`, `get_sweep` | S/M | `trials/sec`, early-stop 准确率 | 最优 trial 在真实最优附近 |
| SW-2 | 多 agent 并发 sweep | `agent` × N | S/M/L | 并发下 trials/sec | 无重复 trial、无竞态失败 |

### 4.5 Launch

| ID | 场景 | SDK API | 级别 | 主要指标 | 断言 |
|---|---|---|---|---|---|
| LN-1 | Enqueue / dequeue / execute | `launch`, `launch_agent` | S | job 执行成功 | run 状态 finished |
| LN-2 | Launch queue 并发消费 | `launch_agent` × N | S/M | throughput (jobs/min) | 无 job 丢失 |

### 4.6 Evaluations

| ID | 场景 | SDK API | 级别 | 主要指标 | 断言 |
|---|---|---|---|---|---|
| EV-1 | 完整 eval 生命周期 | `init_eval`, `log_eval_result`, `log_eval_summary`, `finish_eval` | S/M | eval 创建/结果查询 latency | summary 聚合正确 |
| EV-2 | 大量 eval results | `log_eval_result` × N | S/M/L | `results/sec` | 查询总数正确 |

### 4.7 Traces & Spans

| ID | 场景 | SDK API | 级别 | 主要指标 | 断言 |
|---|---|---|---|---|---|
| TR-1 | 单 trace 多 span 树 | `trace`, `span` | S/M/L | `spans/sec`, p95 latency | trace 结构完整 |
| TR-2 | RAG / Agent trace 仿真 | `start_trace`, `finish_trace`, `start_span`, `finish_span` | S/M | p50/p95 latency | span 父子关系正确 |

### 4.8 Reports & Public API

| ID | 场景 | SDK API | 级别 | 主要指标 | 断言 |
|---|---|---|---|---|---|
| RP-1 | LuminaReport 创建与发布 | `LuminaReport` | S | report 可访问 | blocks 渲染正确 |
| PA-1 | PublicApi runs/projects 查询 | `LuminaPublicApi.runs`, `.projects` | S/M | 查询 latency | 返回字段完整 |

### 4.9 Auth & Multi-workspace

| ID | 场景 | SDK API | 级别 | 主要指标 | 断言 |
|---|---|---|---|---|---|
| AW-1 | Workspace 切换与隔离 | `LuminaClient(workspace_id=...)` | S | 403 隔离正确 | A workspace 数据不可被 B 访问 |
| AW-2 | API key 轮换 / forgot-key | `LuminaClient.create_user`, rotate-key | S | 轮换后旧 key 失效 | 旧 key 返回 401 |

## 5. 执行框架（建议实现）

### 5.1 文件结构

```
benchmarks/
  Wandb-Scenario-Benchmark.md      # 本文档
  scenario_runner.py               # 统一入口（已接入 10 个场景）
  scenarios/
    __init__.py                    # 已创建
    base.py                        # Scenario 抽象基类 + LEVEL_PARAMS（已创建）
    experiment_tracking.py         # ET-1, ET-2 已实现；ET-3 ~ ET-5 待补充
    artifacts.py                   # AR-1 ~ AR-3 已实现（AR-1/AR-2 本地 docker 可能 skip）
    media_tables.py                # MD-1 ~ MD-2 待实现
    sweeps.py                      # SW-1, SW-2 已实现
    launch.py                      # LN-1 ~ LN-2 待实现
    evaluations.py                 # EV-1 ~ EV-2 待实现
    traces.py                      # TR-1 已实现（span 树细节验证待补齐）；TR-2 待实现
    reports_public_api.py          # PA-1 已实现；RP-1 待实现
    auth_workspace.py              # AW-1 已实现；AW-2 待实现
```

### 5.2 `Scenario` 基类约定

```python
class Scenario:
    name: str
    level: Literal["S", "M", "L", "XL"]

    def setup(self): ...
    def run(self) -> dict:      # 返回指标字典
    def teardown(self): ...
    def assert_correctness(self): ...
```

### 5.3 运行方式

```bash
# 快速模式：fake backend，只做契约与正确性回归
python benchmarks/scenario_runner.py --mode fake --level S

# 验收模式：真实 docker compose 全栈
python benchmarks/scenario_runner.py --mode real --level L

# 只跑指定场景
python benchmarks/scenario_runner.py --mode real --level M --scenario ET-2 AR-1
```

### 5.4 输出格式

每个场景输出 JSON Lines，最终汇总：

```json
{
  "scenario": "ET-2",
  "level": "L",
  "mode": "real",
  "status": "passed",
  "metrics": {
    "points/sec": 125000,
    "p95_latency_ms": 12.5,
    "total_points": 1000000
  },
  "assertions": { "count_match": true, "summary_match": true }
}
```

## 6. 与现有 benchmark 的关系

现有脚本保留为**垂直场景示例**（CV、LLM、RAG、Sweep），新增 `scenario_runner.py` 为**水平 API 覆盖 + 数据分级**的验收框架。未来目标：

- 把 `cv_training_benchmark.py` 等改写成 `scenarios/cv_training.py`，接入统一 runner。
- 统一使用 `_common.py` 中的 `Timer`、`percentile`、`check_server`、`ensure_auth`。

## 7. 推荐实施顺序

1. ✅ **先实现 `scenarios/base.py` + `scenario_runner.py` 骨架**
2. ✅ **ET-1 / ET-2 / AR-1 / SW-1 / PA-1** 作为第一批核心场景
3. ✅ **AR-2 / AR-3 / SW-2 / TR-1 / AW-1** 作为第二批核心场景
4. **MR-1 / MD-1 / MD-2 / LN-1 / EV-1** 补齐（2d）
5. **XL 级别 + 真实后端压测 + TR-1 span 树完整验证**（1-2d）

## 8. 验收标准

当本 benchmark 在 **Large** 级别、真实后端下全部通过时，可认为 Lumina 已具备 Wandb 核心场景的替代能力。

XL 级别用于发现架构瓶颈（metric 写入、artifact 上传、ClickHouse 查询、Redis queue），不作为功能验收必要条件。
