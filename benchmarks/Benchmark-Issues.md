# Benchmark Issues

> 记录 Lumina benchmark 全量跑测过程中发现的问题。
> 本次跑测时间：2026-07-20
> 后端环境：本地 `docker compose`（Postgres + ClickHouse + Redis + MinIO + Server），`http://localhost:8000/healthz` 正常。

## 本次跑测范围

| 跑测项 | 命令 | 说明 |
|---|---|---|
| Scenario runner S 级（真实后端） | `uv run python ../../benchmarks/scenario_runner.py --mode real --level S` | 23 个场景全量 |
| Scenario runner M 级（真实后端） | `uv run python ../../benchmarks/scenario_runner.py --mode real --level M` | 23 个场景全量 |
| Scenario runner S 级（fake 后端） | `uv run python ../../benchmarks/scenario_runner.py --mode fake --level S` | 23 个场景全量 |
| 旧版独立 benchmark | `uv run python ../../benchmarks/run_all.py` | 5 个 `*_benchmark.py` |

> 注：L / XL 级别未在本次跑测中执行。按当前 M 级 `ET-2` 吞吐约 50 points/sec 估算，L 级（100K points）单场景约 30 分钟，XL 级（1M points）约 5 小时以上，建议在修复 S/M 级问题并配置公共 S3 endpoint 后再专项压测。

---

## 1. 汇总结果

### 1.1 `scenario_runner.py` 汇总

| 模式 | 级别 | PASSED | FAILED | SKIPPED | 备注 |
|---|---|---|---|---|---|
| real | S | 17 | 0 | 6 | 与文档一致 |
| real | M | 17 | 0 | 6 | 与 S 级相同 6 个 skip |
| fake | S | 17 | 0 | 6 | fake 模式下 artifact 场景仍因真实 S3 URL 跳过 |

每次跑测跳过的场景均为：
- `AR-1`：Artifact 上传/下载/校验
- `AR-2`：大量小文件 Artifact
- `MD-1`：Image / Video / Audio / Plotly 媒体日志
- `MD-2`：LuminaTable 与 confusion matrix
- `MR-1`：log_model / use_model / link_model
- `AW-2`：API key 轮换 / forgot-key

### 1.2 旧版 `run_all.py` 汇总

| 脚本 | 结果 | 关键错误 |
|---|---|---|
| `cv_training_benchmark.py` | FAILED | `HTTP 502: Bad Gateway`（上传 Artifact 到 `minio:9000` 失败） |
| `llm_finetune_benchmark.py` | FAILED | `HTTP 502: Bad Gateway`（同上） |
| `rag_agent_benchmark.py` | FAILED | `HTTP 404: {"error":"Trace not found"}`（创建 span 时 trace 不存在） |
| `sweep_tabular_benchmark.py` | FAILED | `AttributeError: 'tuple' object has no attribute 'get'`（`lumina/backend/sweep.py:279`） |
| `throughput_benchmark.py` | FAILED | `Connection failed: [Errno 32] Broken pipe`（上传 Artifact 到 `minio:9000`） |

---

## 2. 问题清单

### Issue-1：本地 docker compose 下 Artifact/Media/Model Registry 场景因 S3 presigned URL 指向内网 hostname 无法执行

- **影响场景**：`AR-1`, `AR-2`, `MD-1`, `MD-2`, `MR-1`
- **表现**：场景主动 skip，错误示例
  ```
  Artifact storage endpoint is not reachable from the benchmark host
  (presigned URL: http://minio:9000/lumina-artifacts/blobs/...)
  ```
- **根因**：Server 生成的 MinIO presigned URL 使用容器内 hostname `minio:9000`，从宿主机（benchmark 主机）无法解析或访问。
- **复现**：`uv run python ../../benchmarks/scenario_runner.py --mode real --level S --scenario AR-1 MD-1 MR-1`
- **修复方向**：
  1. 在容器网络内执行 benchmark（例如新建 `benchmark` service 跑 `scenario_runner.py`）；或
  2. 配置公共 S3 endpoint / `MINIO_SERVER_URL`，让 presigned URL 使用宿主机可达地址。
- **优先级**：高（阻塞 Artifact / Media / Model Registry 全量验证）

### Issue-2：`AW-2` API key 轮换接口返回 404

- **影响场景**：`AW-2`
- **表现**：
  ```
  rotate_status_code: 404
  HTTP 404: {"error":"Not found"}
  ```
- **根因**：本地 compose 未配置 `LUMINA_ROTATE_KEY_EMAILS` allowlist，rotate-key 路由未启用。
- **复现**：`uv run python ../../benchmarks/scenario_runner.py --mode real --level S --scenario AW-2`
- **修复方向**：在服务端环境变量中配置允许轮换 key 的邮箱列表，或在 benchmark 前置条件中说明并 skip。
- **优先级**：中

### Issue-3：`SW-1` `best_run_recorded` 断言为 false

- **影响场景**：`SW-1`
- **表现**：场景状态为 `passed`，但断言中 `best_run_recorded: false`。
  ```json
  {"sweep_created": true, "observations_recorded": true, "best_run_recorded": false}
  ```
- **根因**：sweep 完成后未正确回写/识别最优 trial 对应的 run。
- **复现**：任意级别 `SW-1` 均可复现。
- **修复方向**：补齐 sweep 结果汇总逻辑，确保最优 run 被记录并可通过 `get_sweep` 查询到。
- **优先级**：中

### Issue-4：`TR-1` 仅验证 trace 创建与列表，未验证 span 树结构

- **影响场景**：`TR-1`
- **表现**：断言只有 `trace_created` 和 `trace_listed`。
- **根因**：`/traces/:traceId/spans` 的 workspace guard 当前仍走 Prisma，ClickHouse trace 的 authz 查询尚未统一，导致 span 树细节验证被搁置。
- **修复方向**：将 ClickHouse trace 查询接入 workspace guard，之后补齐 span 父子关系、数量、字段等断言。
- **优先级**：中

### Issue-5：fake 模式下 Artifact / Media / Model Registry 仍尝试访问真实 MinIO

- **影响场景**：`AR-1`, `AR-2`, `MD-1`, `MD-2`, `MR-1`
- **表现**：`--mode fake` 下上述场景仍因 `minio:9000` 不可达而 skip，与 real 模式表现相同。
- **根因**：`fake` 后端当前未对对象存储进行 mock，SDK 仍按真实 S3 上传流程执行。
- **修复方向**：在 fake 模式下短路/ mock 文件上传，返回本地内存 URL 或跳过实际 HTTP 上传，使 artifact 场景可在 CI 快速回归。
- **优先级**：中

### Issue-6：旧版 `rag_agent_benchmark.py` 创建 span 时 404 Trace not found

- **影响脚本**：`benchmarks/rag_agent_benchmark.py`
- **表现**：
  ```
  lumina.backend.client.LuminaClientError: HTTP 404: {"error":"Trace not found"}
  at lumina/backend/client.py:638 in create_span
  ```
- **根因**：脚本调用 `lumina.start_span` 时，trace 可能未正确创建/传播，或服务端 trace 创建后未立即在查询路径可见。
- **复现**：`uv run python ../../benchmarks/rag_agent_benchmark.py`
- **修复方向**：
  1. 检查 SDK `start_span` 是否自动创建 trace；
  2. 检查服务端 `/api/v1/traces/:id/spans` 路由是否在 trace 写入 ClickHouse 前做了强一致性校验。
- **优先级**：高（RAG/Agent trace 场景阻塞）

### Issue-7：旧版 `sweep_tabular_benchmark.py` sweep agent 解析 step 异常

- **影响脚本**：`benchmarks/sweep_tabular_benchmark.py`
- **表现**：
  ```
  File "lumina/backend/sweep.py", line 279, in agent
      step = int(entry.get("step", 0))
             ^^^^^^^^^
  AttributeError: 'tuple' object has no attribute 'get'
  ```
- **根因**：`lumina/backend/sweep.py:279` 处 `entry` 为元组而非字典，未做兼容处理。
- **修复方向**：在 agent 循环中对 `entry` 类型做判断（dict / tuple / list），统一提取 step 与参数。
- **优先级**：高

### Issue-8：旧版 Artifact 相关 benchmark 因 S3 内网 hostname 502 / Broken pipe

- **影响脚本**：`cv_training_benchmark.py`, `llm_finetune_benchmark.py`, `throughput_benchmark.py`
- **表现**：上传 Artifact 文件时报 `HTTP 502: Bad Gateway` 或 `Broken pipe`。
- **根因**：与 Issue-1 相同，上传目标为 `minio:9000`，宿主机无法访问。
- **修复方向**：同 Issue-1。
- **优先级**：高

### Issue-9：`_common.ensure_auth()` 频繁报 409 用户已存在

- **影响范围**：所有使用 `_common.ensure_auth()` 的 benchmark
- **表现**：每次场景开始打印
  ```
  (auth skipped: HTTP 409: {"error":"Conflict","message":"A user with this email already exists.","field":"email"})
  ```
- **根因**：`ensure_auth` 使用 `int(time.time())` 作为邮箱后缀，多场景在同一秒内启动会冲突；且未做去重/复用逻辑。
- **影响程度**：低（当前场景大多能继续执行，仅污染日志并可能导致部分需要新用户的场景失败）
- **修复方向**：邮箱后缀使用更高精度时间戳或 UUID；若服务端已登录则复用现有 key。
- **优先级**：低

---

## 3. 下一步建议

1. **解决 S3 内网 hostname 问题**（Issue-1 / Issue-8）：这是当前最大阻塞，建议优先配置公共 S3 endpoint 或在容器内跑 benchmark。
2. **修复 sweep agent 类型错误**（Issue-7）和 trace span 创建问题（Issue-6），使旧版 benchmark 能跑通。
3. **补齐 `SW-1` best run 汇总**（Issue-3）和 `TR-1` span 树验证（Issue-4）。
4. **fake 模式下 mock 对象存储**（Issue-5），让 artifact/media/model registry 场景进入 CI 快速回归。
5. **配置 rotate-key allowlist**（Issue-2）后重新验证 `AW-2`。
6. 以上 S/M 级问题修复后，再安排 L / XL 级别全量压测。

## 自动跑测补充：real M 级（2026-07-21 04:34:03）

- 命令：`uv run python scenario_runner.py --mode real --level M`
- 日志：`logs/scenario_real_M_20260721-043209.log`
- 退出码：`1`
- 汇总：PASSED=16 FAILED=1 SKIPPED=6

### 各场景结果

| Scenario | Status | 关键指标 / 错误 |
|---|---|---|
| AR-1 | skipped | Artifact storage endpoint is not reachable from the benchmark host (presigned URL: http://minio:9000/lumina-artifacts/blobs/sha256/4b/4b3439047a6253aa43ad68aa50761954a49748d518e34d61bc254aab3b6a536e/tmpq9n6c3x3?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=minioadmin%2F20260720%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20260720T203209Z&X-Amz-Expires=300&X-Amz-Signature=028f56d1ddded1452e9acac0ca341f05a080d5ad4cd619edaaedb66d915d9d14&X-Amz-SignedHeaders=host&x-amz-checksum-crc32=AAAAAA%3D%3D&x-amz-sdk-checksum-algorithm=CRC32&x-id=PutObject). Run benchmarks inside the Docker network or configure a public S3 endpoint. |
| AR-2 | skipped | Artifact storage endpoint is not reachable from the benchmark host (presigned URL: http://minio:9000/lumina-artifacts/blobs/sha256/91/913bea5c2f5b94d7eede7a4ddec9110d312682917cbc114eb4f729a26428d02c/file_0000.txt?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=minioadmin%2F20260720%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20260720T203210Z&X-Amz-Expires=300&X-Amz-Signature=a1fbb7f50eb83d2f0744830d2f82be81bfd6776e642be6eb4c4acc19fd439b98&X-Amz-SignedHeaders=host&x-amz-checksum-crc32=AAAAAA%3D%3D&x-amz-sdk-checksum-algorithm=CRC32&x-id=PutObject). Run benchmarks inside the Docker network or configure a public S3 endpoint. |
| AR-3 | passed | parent_version_id=ab66ae9a-86c4-4fe4-96fd-f4852b7f0bf8 child_version_id=81f3115c-3174-4a2e-9626-9cab70c0ed78 |
| AW-1 | passed | default_workspace_id=default run_id=019f813a-9f80-75a5-a368-11120bfa9e56 create_elapsed_ms=12.47 isolated_status_code=403 |
| AW-2 | skipped | HTTP 404: {"error":"Not found"} |
| ET-1 | passed | init_ms=9.61 log_ms=381.68 finish_ms=33.02 |
| ET-2 | passed | steps=1000 keys_per_step=4 total_points=4000 elapsed_sec=77.873 points/sec=51.4 p95_ms=None |
| ET-3 | passed | steps=20 log_lines=100 system_metric_points=60 returned_logs=100 elapsed_ms=9102.73 |
| ET-4 | passed | run_id=019f813b-f646-790c-946f-6a90c780b858 elapsed_ms=61.0 |
| ET-5 | passed | run_id=019f813b-f83f-7fc2-8113-54c20053f6cf tag_count=2 elapsed_ms=27.44 |
| EV-1 | passed | eval_id=525e762e-5e1f-42c9-adb1-c3e249019935 elapsed_ms=138.6 result_count=2 |
| EV-2 | failed | LuminaClientError: Connection failed: [Errno 60] Operation timed out |
| LN-1 | passed | queue_id=370a4bec-2405-4e14-b6e4-a6c874c2908b job_id=53aa3c92-290b-4de6-8121-3e77cac25515 launch_run_id=68f5c6f7-9ef8-4320-8c67-1e40f2bd9ebb executed_count=1 elapsed_sec=0.149 |
| LN-2 | passed | agents=4 runs_per_agent=2 expected_total=8 executed_total=8 completed_total=8 elapsed_sec=0.145 runs/sec=55.26 |
| MD-1 | skipped | Artifact storage endpoint is not reachable from the benchmark host (presigned URL: http://minio:9000/lumina-artifacts/blobs/sha256/ea/eaa6abc3959144aad7472efa4de398579949ef494209a191a41c910cada55c3b/image.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=minioadmin%2F20260720%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20260720T203358Z&X-Amz-Expires=300&X-Amz-Signature=451f9ac0b1b294fb7438d3da2faff460886583e00e8c4bab9bfa9917875eafdc&X-Amz-SignedHeaders=host&x-amz-checksum-crc32=AAAAAA%3D%3D&x-amz-sdk-checksum-algorithm=CRC32&x-id=PutObject). Run benchmarks inside the Docker network or configure a public S3 endpoint. |
| MD-2 | skipped | Artifact storage endpoint is not reachable from the benchmark host (presigned URL: http://minio:9000/lumina-artifacts/blobs/sha256/2c/2c589ab623deecbb17a74785e4fb2405e5b21c5565071f649ece33d59d010354/table.csv?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=minioadmin%2F20260720%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20260720T203358Z&X-Amz-Expires=300&X-Amz-Signature=12e749047269c1bb8733dac0017ffa8b0ba3d3a0fb0d20f26b5799b481e2e8f5&X-Amz-SignedHeaders=host&x-amz-checksum-crc32=AAAAAA%3D%3D&x-amz-sdk-checksum-algorithm=CRC32&x-id=PutObject). Run benchmarks inside the Docker network or configure a public S3 endpoint. |
| MR-1 | skipped | Artifact storage endpoint is not reachable from the benchmark host (presigned URL: http://minio:9000/lumina-artifacts/blobs/sha256/4a/4acec6be275c7388edbcd03fe7b2049df42d186f144d583b20c04416f71c62e5/tmprqoyzn33?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=minioadmin%2F20260720%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20260720T203358Z&X-Amz-Expires=300&X-Amz-Signature=0e42a96416e89ec2d67c6369a54c21a1900a440e48288fdd73d0a7c73f7d38e3&X-Amz-SignedHeaders=host&x-amz-checksum-crc32=AAAAAA%3D%3D&x-amz-sdk-checksum-algorithm=CRC32&x-id=PutObject). Run benchmarks inside the Docker network or configure a public S3 endpoint. |
| PA-1 | passed | seeded_runs=3 queried_runs=50 queried_projects=23 runs_query_ms=23.5 projects_query_ms=8.01 |
| RP-1 | passed | report_id=7a763db9-cd5e-476c-aea7-9b127a8972fd create_ms=9.06 patch_ms=12.93 listed_count=7 |
| SW-1 | passed | trials=8 terminated=0 finished=8 elapsed_sec=2.04 trials/sec=3.92 observations=8 |
| SW-2 | passed | agents=4 trials_per_agent=3 expected_total=12 unique_runs=12 observations=12 elapsed_sec=0.559 trials/sec=21.48 |
| TR-1 | passed | trace_id=9f0de744-751e-4808-b778-1e27ad088191 elapsed_ms=97.57 |
| TR-2 | passed | query_count=10 trace_ids=10 listed_count=35 elapsed_ms=765.46 |

### 新增 failed 场景

- `EV-2`: LuminaClientError: Connection failed: [Errno 60] Operation timed out

