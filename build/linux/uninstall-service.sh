#!/bin/sh

SERVICE_NAME='PerzikeService'
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)"
SERVICE_BINARY="$SCRIPT_DIR/perzike-service"
UNIT_FILE="/etc/systemd/system/$SERVICE_NAME.service"
INIT_FILE="/etc/init.d/$SERVICE_NAME"
UPSTART_FILE="/etc/init/$SERVICE_NAME.conf"
RUNTIME_DIR='/run/perzike'
SYSTEMD_DIR='/run/systemd/system'

is_service_pid() {
    case "$1" in
        ''|*[!0-9]*|0|1) return 1 ;;
    esac
    executable="$(readlink "/proc/$1/exe" 2>/dev/null)" || return 1
    case "$executable" in
        "$SERVICE_BINARY"|"$SERVICE_BINARY (deleted)"|/run/perzike/service/*/perzike-service*)
            kill -0 "$1" 2>/dev/null ;;
        *) return 1 ;;
    esac
}

service_pid() {
    for pid_file in "/run/$SERVICE_NAME.pid" "/var/run/$SERVICE_NAME.pid"; do
        if [ -f "$pid_file" ]; then
            candidate="$(cat "$pid_file" 2>/dev/null)"
            if is_service_pid "$candidate"; then
                printf '%s\n' "$candidate"
                return 0
            fi
        fi
    done
    return 1
}

wait_for_service_pid() {
    attempts=0
    while is_service_pid "$1"; do
        if [ "$attempts" -ge 30 ]; then
            echo 'Perzike service is still running; refusing to remove service files.' >&2
            return 1
        fi
        sleep 0.5
        attempts=$((attempts + 1))
    done
}

remove_perzike_service() {
    old_pid="$(service_pid || true)"
    systemd_running=false
    if [ -d "$SYSTEMD_DIR" ] && command -v systemctl >/dev/null 2>&1; then
        systemd_running=true
        load_state="$(systemctl show "$SERVICE_NAME.service" --property=LoadState --value)" || {
            if [ "$load_state" != 'not-found' ]; then
                return 1
            fi
        }
        if [ "$load_state" != 'not-found' ]; then
            systemctl stop "$SERVICE_NAME.service" || return 1
            systemctl disable "$SERVICE_NAME.service" || return 1
        fi
    elif [ -f "$INIT_FILE" ]; then
        if command -v rc-service >/dev/null 2>&1; then
            rc-service "$SERVICE_NAME" stop || {
                state="$(LC_ALL=C rc-service "$SERVICE_NAME" status 2>&1)" || true
                case "$state" in
                    stopped|*'status: stopped'*) ;;
                    *) return 1 ;;
                esac
            }
        else
            "$INIT_FILE" stop || {
                "$INIT_FILE" status >/dev/null 2>&1
                if [ "$?" -ne 3 ]; then
                    return 1
                fi
            }
        fi
    elif [ -f "$UPSTART_FILE" ] && command -v initctl >/dev/null 2>&1; then
        initctl stop "$SERVICE_NAME" || {
            state="$(initctl status "$SERVICE_NAME")" || return 1
            case "$state" in
                *stop/waiting*) ;;
                *) return 1 ;;
            esac
        }
    elif [ -x "$SERVICE_BINARY" ]; then
        "$SERVICE_BINARY" service uninstall || return 1
    fi

    if [ -n "$old_pid" ]; then
        if is_service_pid "$old_pid"; then
            kill "$old_pid" || return 1
        fi
        wait_for_service_pid "$old_pid" || return 1
    fi

    for link in /etc/systemd/system/*.wants/PerzikeService.service \
        /etc/systemd/system/*.requires/PerzikeService.service \
        /etc/rc?.d/[KS][0-9][0-9]PerzikeService /etc/runlevels/*/PerzikeService; do
        if [ -L "$link" ]; then
            rm -f "$link" || return 1
        fi
    done
    rm -f "$UNIT_FILE" "$INIT_FILE" "$UPSTART_FILE" \
        "/run/$SERVICE_NAME.pid" "/var/run/$SERVICE_NAME.pid" \
        /tmp/perzike-service.sock "$RUNTIME_DIR/service-was-running" || return 1

    if [ "$systemd_running" = true ]; then
        systemctl daemon-reload || return 1
        systemctl reset-failed "$SERVICE_NAME.service" >/dev/null 2>&1 || true
    fi
    rm -rf "$RUNTIME_DIR/service" || return 1
    rmdir "$RUNTIME_DIR" 2>/dev/null || true
}

remove_perzike_service
