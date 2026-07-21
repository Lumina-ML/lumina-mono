# Code Review

## Node.js Server

1. Modules出现了同一个实例在多处route实例化;
2. 发现EventBus没有从zod层面编译时甚至没有运行时的统一，业务随便传type，都是基于约定
```typescript
await this.deps.eventBus?.publish({
  type: "ArtifactUploaded",
  payload: eventPayload,
  occurredAt: new Date(),
});
```
3. Queue同上
4. 得Review一下有没有一致性/幂等性问题
5. hanlder层的错误处理不太行，而且没有日志，甚至好多地方console.log这不对
6. 没有一层依赖注入
7. Processor也直接拿到了prisma，会不会有问题？会不会有并发读/写的问题，是个黑盒
8. Run接口(api/v1/runs?limit=200&offset=0)报错{
    "error": "ValidationError",
    "message": "Request body or params failed schema validation.",
    "issues": [
        {
            "path": "limit",
            "code": "too_big",
            "message": "Number must be less than or equal to 100"
        }
    ]

}
## Vue.js Dashboard

1. 组件库的ErrorBoundary没有应用在我们的App
2. AppLayout，我们的Sidbar改一下，完全不需要有Pin的能力很奇怪
3. <button>我们原子组件用组件库的，怎么能用<butotn>这种呢？扫一遍都要解决，img avatar为什么不直接用avatar注入此类的问题
4. AppLayout的代码不够优雅，这几个Dialog都封装一下
5. workspace这里的layout 同步，要考虑mobile，比如mobile的时候不应该直接set的，到时候布局很奇怪，要做一件事情mobile -> desktop 自动重置layout。反过来也一样
6. 业务组件别放useMutation quey等，业务组件只消费composable，封装好别偷懒
7. metric没有页面承接？
8. RunDetail太大了，抽象和隔离组件
9. 还有好几个页面业务逻辑没有实现
10. DEFAULT_SECTIONS 啥意思？没必要吧
11. 好几个页面ADD Section还是浏览器默认的
12. 整个Sidbar随着容器一起滚动不对吧？内容高了，sidebar也要scroll
13. http://localhost:3000/api/v1/runs?project=29e454ce-1a34-4d45-960b-6be84849bc04&limit=1&offset=0
返回{
    "items": [
        {
            "id": "2b65e1e4-b3a1-4acb-90c7-d67d942b0dff",
            "runId": "019f84e8-33e1-70e4-9018-ad0aabdf71b9",
            "projectId": "8d4eab9c-96e9-4399-ac57-e74c138f0392",
            "sweepId": "f1ba28f5-0a03-406f-9042-4d9d502e9880",
            "name": "bench-concurrent-1784641237-3",
            "status": "finished",
            "config": {
                "lr": 0.002363692888225332
            },
            "summary": {},
            "notes": null,
            "metadata": {},
            "telemetry": {},
            "metricDefs": {},
            "displayName": null,
            "group": null,
            "jobType": null,
            "startedAt": "2026-07-21T13:40:37.986Z",
            "finishedAt": "2026-07-21T13:40:38.073Z",
            "createdAt": "2026-07-21T13:40:37.986Z",
            "updatedAt": "2026-07-21T13:40:38.074Z"
        }
    ],
    "total": 22
}
14. Project-scoped launch
Viewing trace-project
The launch monitor at /launch shows queues across all projects. To scope to this project only, pick it from the project picker there.
不支持就去掉？
15. http://localhost:3000/projects/29e454ce-1a34-4d45-960b-6be84849bc04/settings 子content空。。
16. http://localhost:3000/datasets 404
17. Model Registry http://localhost:3000/models?new=1点击New没用。。。只是url改了
18. http://localhost:3000/settings/billing mock的数据？这个页面可以不做的，我们现在是开源版本，还在mvp阶段，这个下掉吧
19. 很迷惑：到底有几个settings？
20. http://localhost:3000/settings/api-keys 这里的CRUD都不work
21. http://localhost:3000/settings/members 空白
22. Workspace and user settings will be available here. http://localhost:3000/settings 还没做？
23. ADMIN一个Sidebar Settings -> Members -> API Keys，但是实际上都在Settings里面？
24. EXECUTION下的几个都redirect到了project
25. 还有REPORT，Traces
26. DataSets/Settings/Projects/WorkSpace Home/ Model Registry/ Monitoring
这几个一个主路由
剩下project唯独的都在一个project详情页
27. http://localhost:3000/projects/8d4eab9c-96e9-4399-ac57-e74c138f0392/runs/019f84e8-33e1-7b2f-8b97-2e2ebbd259e7 runs的列表页还是详情页，这不对吧？从workspace recent view进来的，很奇怪，这个后缀id不对看起来是一个详情页，就不应该跳进来？进来也是404吧但是跳到了project的Run页面(还展示了这个Run的detail)
28. Run详情页好多问题：
    1.  Columns Modal和屏幕一样宽。。。
    2.  没有选择Done，就看到列改了？
    3.  Operation这里下拉还是操作系统本身默认的select
    4.  过滤操作设置好，没有搜索过滤？
    5.  Input搜索一样没用
    6.  Compact/Standard/Comfy 切换没用
    7.  分页器切换也没用？offset limit切换都没用
    8.  分页器active后hover的颜色有问题，和not active一致，会显得和奇怪，应该有一个active更深的hover色？
    9.  http://localhost:3000/projects/8d4eab9c-96e9-4399-ac57-e74c138f0392/runs/019f84e8-337c-74b2-9612-c9d6cfcb588e从runList也会进入这个很奇怪？这个页面完全奇怪
29. DataTable数据空的时候没有Empty，而是一个空数组的状态
30. run详情页launch tab下 The launch monitor at /launch shows queues across all projects. To scope to this project only, pick it from the project picker there.还没接入？
31. run detail -> settings tab -> 完全空白
32. Overviews啥也没有，RunList没有请求？Overview存在，不需要Runs tab了吧毫无意义
33. overviews左侧请求切换都是空，右边面板都是mock的default
