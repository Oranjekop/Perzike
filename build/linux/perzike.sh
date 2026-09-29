#!/usr/bin/bash

XDG_CONFIG_HOME=${XDG_CONFIG_HOME:-~/.config}

if [[ -f "${XDG_CONFIG_HOME}/perzike-flags.conf" ]]; then
    mapfile -t PERZIKE_USER_FLAGS <<<"$(grep -v '^#' "${XDG_CONFIG_HOME}/perzike-flags.conf")"
    echo "User flags:" "${PERZIKE_USER_FLAGS[@]}"
fi

exec /opt/perzike/perzike "${PERZIKE_USER_FLAGS[@]}" "$@"
