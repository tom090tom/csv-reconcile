# 贡献与 Git 维护规范

## 工作流

1. 先用 Issue 描述问题或需求；小修复可直接 PR。漏洞走 [私密安全渠道](SECURITY.md)，所有示例先脱敏。
2. 从最新 `main` 建短期分支：维护者使用 `codex/<主题>`，外部贡献者可用 `feat/<主题>`、`fix/<主题>` 或 `docs/<主题>`。
3. 一个 PR 解决一个问题。行为变更增加回归测试，运行 `npm test`、`npm run check`、`git diff --check`，在 PR 记录实际环境与结果。
4. 使用 PR 模板说明问题、取舍、验证、风险及兼容性。审查检查边界输入、精确金额、重复订单、数据隐私和文档一致性。
5. 发布后 `main` 要求 PR、至少一名具备仓库写权限的独立审查者批准、过期批准自动失效、讨论解决。AI 的本地审查记录不等同于 GitHub Approve。作者不能批准自己的 PR；只有一位维护者时需先找到合适的独立审查者，不得伪造批准。
6. 使用 Squash merge，合并标题遵循约定式提交，合并后删除工作分支。禁止向 `main` 直接推送、强推或删除受保护分支，管理员同样受保护。

CI 暂未启用，因为现有推送凭据没有 `workflow` 权限；[配置模板](docs/ci-template.yml) 已保留。目前 PR 必须记录本地测试证据，审查者复核，分支保护不伪装成自动测试门禁。后续启用 CI 并验证成功后，再把真实测试任务设为必需状态检查。

## 约定式提交

按 [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)：

```text
fix(export): neutralize full-width formula prefixes
feat(mapping): add named mapping presets
docs(security): explain local data boundaries
```

允许类型：`feat`、`fix`、`docs`、`test`、`refactor`、`perf`、`build`、`ci`、`chore`、`revert`。scope 可选，标题描述具体变化；破坏性变更加 `!` 或 `BREAKING CHANGE:` 并解释迁移。PR 评审检查提交与最终 Squash 标题，当前没有自动提交消息校验器。

## 版本、CHANGELOG 与发布

采用 [SemVer 2.0.0](https://semver.org/)，版本格式 `MAJOR.MINOR.PATCH`。`0.x` 是早期版本：缺陷、安全修复用补丁版本；新功能或破坏性变更提升次版本，并明确迁移影响。达到 `1.0.0` 后，破坏性变更提升主版本，兼容功能提升次版本，兼容修复提升补丁版本。

可追踪接口包括共享模块的导出函数、结果结构、CLI 参数与退出码、CSV 解析与对账语义。改动时记录用户可见影响，不能只看代码是否能导入。

- 用户可见改动写入 [CHANGELOG.md](CHANGELOG.md) 的 `Unreleased`；按 Added / Changed / Fixed / Security 等分类记录。
- 发布 PR 同步更新 `package.json`、`package-lock.json` 和 CHANGELOG 版本。`package.json` 的 `private: true` 仅阻止误发 npm，不影响 MIT 开源或 GitHub 公开访问。
- 在已审查并合并的提交上创建注解标签 `vX.Y.Z`，GitHub Release 使用同版 CHANGELOG 内容；已发布标签不移动，错误通过后续补丁纠正。
- 发布前核对测试、许可证、版本一致性、私密资料及真实数据不在 Git 历史中。发布文案注明已验证平台与限制，不把未执行的 CI 写成通过。

创建 PR 示例：`gh pr create --base main --head codex/<主题> --title "fix(scope): concrete change" --body-file <说明文件>`。PR、合并提交、标签与 Release 构成追溯链。
