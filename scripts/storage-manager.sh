#!/bin/bash
#
# Storage Manager - 存储抽象层
# 支持 SQLite 和 PostgreSQL 两种存储后端
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# 默认配置
DEFAULT_PROVIDER="${STORAGE_PROVIDER:-sqlite}"
SQLITE_DB="${SQLITE_DB:-$PROJECT_ROOT/storage/data/agent_harness.db}"
PG_HOST="${PG_HOST:-localhost}"
PG_PORT="${PG_PORT:-5432}"
PG_DB="${PG_DB:-agent_harness}"
PG_USER="${PG_USER:-aharness}"
PG_PASSWORD="${PG_PASSWORD:-}"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[STORAGE]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $*"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*"
}

# 初始化存储系统
init_storage() {
    log_info "Initializing storage system (provider: $DEFAULT_PROVIDER)..."
    
    case "$DEFAULT_PROVIDER" in
        sqlite)
            init_sqlite
            ;;
        postgresql|pg|postgres)
            init_postgresql
            ;;
        *)
            log_error "Unknown storage provider: $DEFAULT_PROVIDER"
            return 1
            ;;
    esac
    
    log_success "Storage system initialized"
}

# 初始化 SQLite
init_sqlite() {
    local db_dir
    db_dir=$(dirname "$SQLITE_DB")
    
    if [[ ! -d "$db_dir" ]]; then
        mkdir -p "$db_dir"
    fi
    
    # 创建表
    sqlite3 "$SQLITE_DB" << 'EOF'
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    channel TEXT,
    context TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    session_id TEXT,
    type TEXT,
    content TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    parent_id TEXT,
    session_id TEXT,
    status TEXT,
    result TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_memories_session_id ON memories(session_id);
CREATE INDEX IF NOT EXISTS idx_tasks_session_id ON tasks(session_id);
EOF

    log_info "SQLite database initialized: $SQLITE_DB"
}

# 初始化 PostgreSQL
init_postgresql() {
    local pg_uri="postgresql://$PG_USER:$PG_PASSWORD@$PG_HOST:$PG_PORT/$PG_DB"
    
    # 创建表
    psql "$pg_uri" << 'EOF'
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    channel TEXT,
    context JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    session_id TEXT REFERENCES sessions(id),
    type TEXT,
    content TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    parent_id TEXT,
    session_id TEXT REFERENCES sessions(id),
    status TEXT,
    result JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_memories_session_id ON memories(session_id);
CREATE INDEX IF NOT EXISTS idx_tasks_session_id ON tasks(session_id);
EOF

    log_info "PostgreSQL database initialized"
}

# ==================== 通用 CRUD 操作 ====================

# 设置值
storage_set() {
    local table="$1"
    local key="$2"
    local value="$3"
    
    case "$DEFAULT_PROVIDER" in
        sqlite)
            sqlite_set "$table" "$key" "$value"
            ;;
        postgresql)
            postgresql_set "$table" "$key" "$value"
            ;;
    esac
}

# 获取值
storage_get() {
    local table="$1"
    local key="$2"
    
    case "$DEFAULT_PROVIDER" in
        sqlite)
            sqlite_get "$table" "$key"
            ;;
        postgresql)
            postgresql_get "$table" "$key"
            ;;
    esac
}

# 删除值
storage_delete() {
    local table="$1"
    local key="$2"
    
    case "$DEFAULT_PROVIDER" in
        sqlite)
            sqlite_delete "$table" "$key"
            ;;
        postgresql)
            postgresql_delete "$table" "$key"
            ;;
    esac
}

# 查询
storage_query() {
    local table="$1"
    local condition="$2"
    
    case "$DEFAULT_PROVIDER" in
        sqlite)
            sqlite_query "$table" "$condition"
            ;;
        postgresql)
            postgresql_query "$table" "$condition"
            ;;
    esac
}

# ==================== SQLite 实现 ====================

sqlite_set() {
    local table="$1"
    local key="$2"
    local value="$3"
    
    sqlite3 "$SQLITE_DB" "INSERT OR REPLACE INTO $table (id, content) VALUES ('$key', '$value');"
}

sqlite_get() {
    local table="$1"
    local key="$2"
    
    sqlite3 "$SQLITE_DB" "SELECT content FROM $table WHERE id = '$key';"
}

sqlite_delete() {
    local table="$1"
    local key="$2"
    
    sqlite3 "$SQLITE_DB" "DELETE FROM $table WHERE id = '$key';"
}

sqlite_query() {
    local table="$1"
    local condition="$2"
    
    sqlite3 "$SQLITE_DB" "SELECT * FROM $table WHERE $condition;"
}

# ==================== PostgreSQL 实现 ====================

postgresql_set() {
    local table="$1"
    local key="$2"
    local value="$3"
    local pg_uri="postgresql://$PG_USER:$PG_PASSWORD@$PG_HOST:$PG_PORT/$PG_DB"
    
    psql "$pg_uri" -c "INSERT INTO $table (id, content) VALUES ('$key', '$value') ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content;"
}

postgresql_get() {
    local table="$1"
    local key="$2"
    local pg_uri="postgresql://$PG_USER:$PG_PASSWORD@$PG_HOST:$PG_PORT/$PG_DB"
    
    psql "$pg_uri" -t -c "SELECT content FROM $table WHERE id = '$key';"
}

postgresql_delete() {
    local table="$1"
    local key="$2"
    local pg_uri="postgresql://$PG_USER:$PG_PASSWORD@$PG_HOST:$PG_PORT/$PG_DB"
    
    psql "$pg_uri" -c "DELETE FROM $table WHERE id = '$key';"
}

postgresql_query() {
    local table="$1"
    local condition="$2"
    local pg_uri="postgresql://$PG_USER:$PG_PASSWORD@$PG_HOST:$PG_PORT/$PG_DB"
    
    psql "$pg_uri" -c "SELECT * FROM $table WHERE $condition;"
}

# ==================== 会话管理 ====================

save_session() {
    local session_id="$1"
    local user_id="$2"
    local channel="$3"
    local context="$4"
    
    case "$DEFAULT_PROVIDER" in
        sqlite)
            sqlite3 "$SQLITE_DB" "INSERT OR REPLACE INTO sessions (id, user_id, channel, context, updated_at) VALUES ('$session_id', '$user_id', '$channel', '$context', datetime('now'));"
            ;;
        postgresql)
            local pg_uri="postgresql://$PG_USER:$PG_PASSWORD@$PG_HOST:$PG_PORT/$PG_DB"
            psql "$pg_uri" -c "INSERT INTO sessions (id, user_id, channel, context, updated_at) VALUES ('$session_id', '$user_id', '$channel', '$context'::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET context = EXCLUDED.context, updated_at = NOW();"
            ;;
    esac
    
    log_success "Session saved: $session_id"
}

get_session() {
    local session_id="$1"
    
    case "$DEFAULT_PROVIDER" in
        sqlite)
            sqlite3 "$SQLITE_DB" "SELECT * FROM sessions WHERE id = '$session_id';"
            ;;
        postgresql)
            local pg_uri="postgresql://$PG_USER:$PG_PASSWORD@$PG_HOST:$PG_PORT/$PG_DB"
            psql "$pg_uri" -c "SELECT * FROM sessions WHERE id = '$session_id';"
            ;;
    esac
}

# ==================== 任务管理 ====================

save_task() {
    local task_id="$1"
    local session_id="$2"
    local status="$3"
    local result="${4:-}"
    
    case "$DEFAULT_PROVIDER" in
        sqlite)
            if [[ -n "$result" ]]; then
                sqlite3 "$SQLITE_DB" "INSERT OR REPLACE INTO tasks (id, session_id, status, result, completed_at) VALUES ('$task_id', '$session_id', '$status', '$result', datetime('now'));"
            else
                sqlite3 "$SQLITE_DB" "INSERT OR REPLACE INTO tasks (id, session_id, status) VALUES ('$task_id', '$session_id', '$status');"
            fi
            ;;
        postgresql)
            local pg_uri="postgresql://$PG_USER:$PG_PASSWORD@$PG_HOST:$PG_PORT/$PG_DB"
            if [[ -n "$result" ]]; then
                psql "$pg_uri" -c "INSERT INTO tasks (id, session_id, status, result, completed_at) VALUES ('$task_id', '$session_id', '$status', '$result'::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, result = EXCLUDED.result, completed_at = NOW();"
            else
                psql "$pg_uri" -c "INSERT INTO tasks (id, session_id, status) VALUES ('$task_id', '$session_id', '$status') ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;"
            fi
            ;;
    esac
    
    log_info "Task saved: $task_id ($status)"
}

# 显示帮助
show_help() {
    cat << EOF
Storage Manager - Storage Abstraction Layer

Usage: $0 <command> [options]

Commands:
    init
        Initialize storage system
    
    set <table> <key> <value>
        Set a value
    
    get <table> <key>
        Get a value
    
    delete <table> <key>
        Delete a value
    
    query <table> <condition>
        Query values
    
    save-session <session_id> <user_id> <channel> <context>
        Save session
    
    get-session <session_id>
        Get session
    
    save-task <task_id> <session_id> <status> [result]
        Save task
    
    help
        Show this help message

Environment Variables:
    STORAGE_PROVIDER    Storage provider (sqlite, postgresql)
    SQLITE_DB           SQLite database path
    PG_HOST             PostgreSQL host
    PG_PORT             PostgreSQL port
    PG_DB               PostgreSQL database
    PG_USER             PostgreSQL user
    PG_PASSWORD         PostgreSQL password

Examples:
    $0 init
    $0 set sessions session-123 '{"user": "test"}'
    $0 get sessions session-123
    $0 save-session session-123 user-456 web '{"task": "test"}'
EOF
}

# 主函数
main() {
    local command="${1:-help}"
    shift || true
    
    case "$command" in
        init)
            init_storage
            ;;
        set)
            if [[ $# -lt 3 ]]; then
                log_error "Usage: $0 set <table> <key> <value>"
                exit 1
            fi
            storage_set "$1" "$2" "$3"
            ;;
        get)
            if [[ $# -lt 2 ]]; then
                log_error "Usage: $0 get <table> <key>"
                exit 1
            fi
            storage_get "$1" "$2"
            ;;
        delete)
            if [[ $# -lt 2 ]]; then
                log_error "Usage: $0 delete <table> <key>"
                exit 1
            fi
            storage_delete "$1" "$2"
            ;;
        query)
            if [[ $# -lt 2 ]]; then
                log_error "Usage: $0 query <table> <condition>"
                exit 1
            fi
            storage_query "$1" "$2"
            ;;
        save-session)
            if [[ $# -lt 4 ]]; then
                log_error "Usage: $0 save-session <session_id> <user_id> <channel> <context>"
                exit 1
            fi
            save_session "$1" "$2" "$3" "$4"
            ;;
        get-session)
            if [[ $# -lt 1 ]]; then
                log_error "Usage: $0 get-session <session_id>"
                exit 1
            fi
            get_session "$1"
            ;;
        save-task)
            if [[ $# -lt 3 ]]; then
                log_error "Usage: $0 save-task <task_id> <session_id> <status> [result]"
                exit 1
            fi
            save_task "$1" "$2" "$3" "${4:-}"
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
