# Extensions 扩展模块

本目录包含 Awesome Agent Harness 的各种扩展模块，用于增强核心功能或提供额外的能力。

## 目录结构

```
extensions/
├── README.md              # 本文件
├── mailbox/               # 文件邮箱系统扩展
│   ├── core/              # 核心脚本
│   ├── protocols/         # 协议定义
│   ├── docs/              # 文档
│   └── runtime/           # 运行时数据
└── [其他扩展]/            # 未来添加的其他扩展
```

## 现有扩展

### 1. Mailbox - 文件邮箱系统

**路径**: `extensions/mailbox/`

**功能**: 为非 Claude Code 环境提供基于文件系统的 Agent 通讯机制。

**核心组件**:
- `core/mailbox.sh` - 邮箱管理器
- `core/message-handler.sh` - 消息处理器
- `core/delivery-daemon.sh` - 投递守护进程
- `protocols/mailbox-protocol.yaml` - 协议定义
- `docs/mailbox-system.md` - 使用文档

**使用方式**:
```bash
# 创建邮箱
cd extensions/mailbox
./core/mailbox.sh create --agent planner

# 发送消息
./core/mailbox.sh send --from planner --to reviewer --type PLAN_COMPLETED --body '{}'

# 启动投递守护进程
./core/delivery-daemon.sh start
```

**文档**: [mailbox/docs/mailbox-system.md](mailbox/docs/mailbox-system.md)

## 扩展开发指南

### 创建新扩展

1. **创建扩展目录**
   ```bash
   mkdir -p extensions/my-extension/{core,docs,config}
   ```

2. **添加 README**
   在扩展目录下创建 `README.md`，说明扩展的功能和使用方法。

3. **实现核心功能**
   在 `core/` 目录下实现扩展的核心脚本。

4. **添加文档**
   在 `docs/` 目录下添加详细的使用文档。

5. **注册扩展**
   在本文档的"现有扩展"部分添加新扩展的说明。

### 扩展规范

#### 目录结构规范

```
extensions/my-extension/
├── README.md              # 扩展说明（必需）
├── core/                  # 核心脚本
│   ├── main.sh           # 主入口脚本
│   └── ...
├── docs/                  # 文档
│   └── usage.md
├── config/                # 配置文件
│   └── config.yaml
├── runtime/               # 运行时数据（可选）
└── tests/                 # 测试脚本（可选）
    └── test.sh
```

#### 脚本规范

1. **路径引用**
   ```bash
   SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
   EXTENSION_ROOT="$(dirname "$SCRIPT_DIR")"
   ```

2. **配置文件路径**
   ```bash
   CONFIG_FILE="${EXTENSION_ROOT}/config/config.yaml"
   ```

3. **运行时数据路径**
   ```bash
   RUNTIME_DIR="${EXTENSION_ROOT}/runtime"
   ```

4. **日志输出**
   ```bash
   LOG_FILE="${EXTENSION_ROOT}/runtime/logs/my-extension.log"
   ```

#### 文档规范

扩展文档应包含以下内容：

1. **功能概述** - 扩展的主要功能
2. **安装说明** - 如何安装和配置
3. **使用指南** - 详细的使用方法
4. **API 文档** - 如果有 API，提供 API 文档
5. **配置说明** - 配置项的详细说明
6. **故障排除** - 常见问题及解决方法

### 扩展示例

```bash
# extensions/my-extension/core/main.sh
#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXTENSION_ROOT="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="${EXTENSION_ROOT}/config/config.yaml"
RUNTIME_DIR="${EXTENSION_ROOT}/runtime"

# 扩展逻辑...
```

## 扩展管理

### 启用扩展

大多数扩展默认启用，只需按照扩展文档中的说明使用即可。

### 禁用扩展

如果需要禁用某个扩展，可以：

1. 重命名扩展目录
   ```bash
   mv extensions/mailbox extensions/mailbox.disabled
   ```

2. 或者删除扩展目录
   ```bash
   rm -rf extensions/mailbox
   ```

### 更新扩展

扩展可以独立更新：

```bash
cd extensions/mailbox
git pull  # 如果扩展是独立的 git 仓库
```

## 贡献扩展

欢迎贡献新的扩展！请遵循以下步骤：

1. Fork 本仓库
2. 在 `extensions/` 目录下创建新扩展
3. 按照扩展规范实现功能
4. 添加完整的文档
5. 提交 Pull Request

## 扩展列表

| 扩展名称 | 版本 | 描述 | 维护者 |
|---------|------|------|--------|
| mailbox | 1.0.0 | 文件邮箱系统 | - |

## 注意事项

1. **独立性** - 每个扩展应该尽可能独立，减少对其他扩展的依赖
2. **配置隔离** - 扩展的配置应该放在自己的 `config/` 目录下
3. **数据隔离** - 扩展的运行时数据应该放在自己的 `runtime/` 目录下
4. **文档完整** - 每个扩展必须有完整的文档
5. **向后兼容** - 更新扩展时应保持向后兼容

## 联系

如有问题或建议，请提交 Issue 或 Pull Request。
