#!/bin/bash
#
# Presence Manager
# 管理 lane 成员在运行时目录中的 presence 信息
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
RUNTIME_DIR="${MOSS_RUNTIME_DIR:-${PROJECT_ROOT}/.runtime}"
TEAMMATES_DIR="${RUNTIME_DIR}/teammates"

RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

show_help() {
    cat << EOF
Presence Manager

Usage: $0 <command> [options]

Commands:
    set --lane <lane> --agent <agent> --lifecycle <state> --availability <value>
        Write teammate presence into runtime directory

    help
        Show this help message

Examples:
    $0 set --lane executor --agent frontend_executor --lifecycle idle --availability 1.0
EOF
}

require_option_argument() {
    local option_name="$1"
    local option_value="${2-}"

    if [[ -z "$option_value" || "$option_value" == --* ]]; then
        log_error "Option ${option_name} requires a value"
        exit 1
    fi
}

require_value() {
    local name="$1"
    local value="$2"

    if [[ -z "$value" ]]; then
        log_error "Missing required option: $name"
        exit 1
    fi
}

validate_lifecycle() {
    local lifecycle="$1"

    case "$lifecycle" in
        idle|busy|offline|draining)
            ;;
        *)
            log_error "Invalid lifecycle: ${lifecycle}. Allowed values: idle, busy, offline, draining"
            exit 1
            ;;
    esac
}

set_presence() {
    local lane=""
    local agent=""
    local lifecycle=""
    local availability=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --lane)
                require_option_argument "--lane" "${2-}"
                lane="${2:-}"
                shift 2
                ;;
            --agent)
                require_option_argument "--agent" "${2-}"
                agent="${2:-}"
                shift 2
                ;;
            --lifecycle)
                require_option_argument "--lifecycle" "${2-}"
                lifecycle="${2:-}"
                shift 2
                ;;
            --availability)
                require_option_argument "--availability" "${2-}"
                availability="${2:-}"
                shift 2
                ;;
            --help|-h)
                show_help
                return 0
                ;;
            *)
                log_error "Unknown option for set: $1"
                exit 1
                ;;
        esac
    done

    require_value "--lane" "$lane"
    require_value "--agent" "$agent"
    require_value "--lifecycle" "$lifecycle"
    require_value "--availability" "$availability"
    validate_lifecycle "$lifecycle"

    local agent_dir="${TEAMMATES_DIR}/${lane}/${agent}"
    local presence_file="${agent_dir}/presence.json"
    local tmp_presence_file=""
    mkdir -p "$agent_dir"
    tmp_presence_file="$(mktemp "${agent_dir}/.presence.json.tmp.XXXXXX")"

    if ! python3 - "$lane" "$agent" "$lifecycle" "$availability" "$tmp_presence_file" <<'PY'
import json
import sys
from datetime import datetime, timezone

lane, agent, lifecycle, availability_raw, presence_file = sys.argv[1:]

try:
    availability = float(availability_raw)
except ValueError:
    print(json.dumps({"error": f"invalid availability: {availability_raw}"}, ensure_ascii=True, separators=(",", ":")), file=sys.stderr)
    sys.exit(1)

if not 0.0 <= availability <= 1.0:
    print(json.dumps({"error": f"availability out of range: {availability_raw}"}, ensure_ascii=True, separators=(",", ":")), file=sys.stderr)
    sys.exit(1)

if availability.is_integer():
    availability = int(availability)

payload = {
    "agent": agent,
    "lane": lane,
    "lifecycle": lifecycle,
    "availability": availability,
    "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
}

with open(presence_file, "w", encoding="utf-8") as fh:
    json.dump(payload, fh, ensure_ascii=True, separators=(",", ":"))

print(json.dumps(payload, ensure_ascii=True, separators=(",", ":")))
PY
    then
        rm -f "$tmp_presence_file"
        exit 1
    fi

    mv -f "$tmp_presence_file" "$presence_file"
}

main() {
    local command="${1:-help}"
    shift || true

    case "$command" in
        set)
            set_presence "$@"
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_warn "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
