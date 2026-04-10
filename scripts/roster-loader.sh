#!/bin/bash
#
# Roster Loader
# 从 agent registry 的 members 区域读取指定 lane 的成员清单
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
REGISTRY_FILE="${MOSS_AGENT_REGISTRY:-${PROJECT_ROOT}/configs/orchestration/agent-registry.yaml}"

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
Roster Loader

Usage: $0 <command> [options]

Commands:
    list --lane <lane>
        List roster members for a lane from members.<lane>

    help
        Show this help message

Examples:
    $0 list --lane executor
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

list_roster() {
    local lane=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --lane)
                require_option_argument "--lane" "${2-}"
                lane="${2:-}"
                shift 2
                ;;
            --help|-h)
                show_help
                return 0
                ;;
            *)
                log_error "Unknown option for list: $1"
                exit 1
                ;;
        esac
    done

    require_value "--lane" "$lane"

    if [[ ! -f "$REGISTRY_FILE" ]]; then
        log_error "Registry file not found: ${REGISTRY_FILE}"
        exit 1
    fi

    if command -v ruby >/dev/null 2>&1; then
        ruby - "$REGISTRY_FILE" "$lane" <<'RUBY'
require "json"
require "yaml"

registry_file, lane = ARGV

begin
  raw = File.read(registry_file, encoding: "UTF-8")
  data = YAML.safe_load(raw, permitted_classes: [], permitted_symbols: [], aliases: false) || {}
rescue Errno::ENOENT
  warn JSON.generate({ error: "registry file not found: #{registry_file}" })
  exit 1
rescue Psych::Exception => e
  warn JSON.generate({ error: "failed to parse registry yaml", detail: e.message })
  exit 1
end

members = data["members"]
unless members.is_a?(Hash)
  warn JSON.generate({ error: "invalid registry: missing members" })
  exit 1
end

lane_members = members[lane]
unless lane_members.is_a?(Hash)
  warn JSON.generate({ error: "lane not found: #{lane}" })
  exit 1
end

backup = lane_members["backup"]
experts = lane_members["experts"]

backup = [] unless backup.is_a?(Array)
experts = [] unless experts.is_a?(Array)

lane_policy = data.dig("lanes", lane, "selection_policy")
global_policy = data["selection_policy"]

lane_policy = {} unless lane_policy.is_a?(Hash)
global_policy = {} unless global_policy.is_a?(Hash)

result = {
  "lane" => lane,
  "selection_policy" => global_policy.merge(lane_policy),
  "backup" => backup,
  "experts" => experts,
  "candidates" => experts.select { |member|
    member.is_a?(Hash) && member.fetch("status", "").to_s.strip.downcase == "candidate"
  }
}

puts JSON.generate(result)
RUBY
        return 0
    fi

    python3 - "$REGISTRY_FILE" "$lane" <<'PY'
import json
import sys

try:
    import yaml
except ImportError as exc:
    print(json.dumps({"error": "yaml parser unavailable", "detail": str(exc)}, ensure_ascii=True, separators=(",", ":")), file=sys.stderr)
    sys.exit(1)

registry_file, lane = sys.argv[1:]

try:
    with open(registry_file, "r", encoding="utf-8") as fh:
        data = yaml.safe_load(fh) or {}
except FileNotFoundError:
    print(json.dumps({"error": f"registry file not found: {registry_file}"}, ensure_ascii=True, separators=(",", ":")), file=sys.stderr)
    sys.exit(1)
except yaml.YAMLError as exc:
    print(json.dumps({"error": "failed to parse registry yaml", "detail": str(exc)}, ensure_ascii=True, separators=(",", ":")), file=sys.stderr)
    sys.exit(1)

members = data.get("members")
if not isinstance(members, dict):
    print(json.dumps({"error": "invalid registry: missing members"}, ensure_ascii=True, separators=(",", ":")), file=sys.stderr)
    sys.exit(1)

lane_members = members.get(lane)
if not isinstance(lane_members, dict):
    print(json.dumps({"error": f"lane not found: {lane}"}, ensure_ascii=True, separators=(",", ":")), file=sys.stderr)
    sys.exit(1)

backup = lane_members.get("backup")
experts = lane_members.get("experts")
backup = backup if isinstance(backup, list) else []
experts = experts if isinstance(experts, list) else []

lane_policy = data.get("lanes", {}).get(lane, {}).get("selection_policy", {})
global_policy = data.get("selection_policy", {})
lane_policy = lane_policy if isinstance(lane_policy, dict) else {}
global_policy = global_policy if isinstance(global_policy, dict) else {}

result = {
    "lane": lane,
    "selection_policy": {**global_policy, **lane_policy},
    "backup": backup,
    "experts": experts,
    "candidates": [
        member for member in experts
        if isinstance(member, dict) and str(member.get("status", "")).strip().lower() == "candidate"
    ],
}

print(json.dumps(result, ensure_ascii=True, separators=(",", ":")))
PY
}

main() {
    local command="${1:-help}"
    shift || true

    case "$command" in
        list)
            list_roster "$@"
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
