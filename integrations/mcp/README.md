# MCP (Model Context Protocol) Configuration

MCP 配置定义与外部服务和工具的集成方式。

## MCP 服务器

| 服务器 | 用途 | 状态 |
|--------|------|------|
| `filesystem` | 文件系统操作 | 内置 |
| `github` | GitHub API 集成 | 可选 |
| `git` | Git 操作 | 内置 |
| `database` | 数据库查询 | 可选 |
| `browser` | 浏览器自动化 | 可选 |
| `shell` | 命令行执行 | 受限 |

## 配置格式

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/allowed/path"],
      "env": {
        "ALLOWED_PATHS": "/project"
      }
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

## 安全考虑

1. **命令注入防护** - 所有命令参数必须验证
2. **路径限制** - 文件系统访问限制在项目目录
3. **令牌管理** - 敏感信息通过环境变量注入
4. **网络限制** - 只允许访问白名单域名

## 添加 MCP 服务器

```bash
# 安装 MCP 服务器
./scripts/mcp-install.sh github

# 配置环境变量
cp mcp/.env.example mcp/.env
# 编辑 .env 文件

# 验证配置
./scripts/mcp-verify.sh
```
