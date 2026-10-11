# Changelog

记录用户可见变化，遵循 [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) 与 [SemVer](https://semver.org/)。

## [Unreleased]

## [0.1.1] - 2026-10-11

### Security

- 本地服务拒绝非本地 Host、不匹配的 Origin 及浏览器跨站请求，增加 Referrer-Policy 和同源资源策略。
- CSV 导出覆盖全角公式起始符及前置控制字符，保留文本导入和二次保存的限制说明。

### Added

- 安全策略、私密漏洞报告指引、使用与免责说明。
- SemVer、约定式提交、PR 审查与发布规范，Issue/PR 模板和变更记录。
- 15 项安全与本地服务边界测试，总计 56 项测试，覆盖默认 HTTP 端口 80。

### Changed

- 项目以 MIT 许可证公开协作，`private: true` 继续阻止意外发布到 npm。

## [0.1.0] - 2026-10-11

### Added

- 本地浏览器与 CLI 对账，精确金额、缺单与重复订单检测。
- 列映射复用、结果筛选、安全 CSV 导出与合成示例。
- UTF-8 CSV 严格解析、规模限制、41 项自动测试与语法检查。
- MIT 许可证和 CI 模板；CI 模板未启用。

[Unreleased]: https://github.com/tom090tom/csv-reconcile/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/tom090tom/csv-reconcile/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/tom090tom/csv-reconcile/releases/tag/v0.1.0
